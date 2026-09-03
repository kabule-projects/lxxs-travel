# 云数据库集合与概率字段

权限：仅云函数读写。概率/权重一律读库，代码只保留缺省回退（与 `shared/constants.ts` 对齐）。

## 集合一览

| 集合 | 用途 |
|------|------|
| users | 玩家资源、pity、nextSpawnAt、gm、currentTripId、riceStars |
| items | 物品（含出行距离/时长范围、地形与明信片权重） |
| destinations | 目的地（baseWeight、地形、距离档、时长、伴手礼池） |
| postcards | 明信片（baseWeight、groupId、可选绑定 destId） |
| game_config | 全局概率旋钮（key 唯一，如 `trip`） |
| gacha_pool | 扭蛋权重 |
| copy_pool | 文案（depart_farewell / shop_talk） |
| user_inventory | `{ userId, itemId, count }` |
| user_showcase | `{ userId, itemId, name?, icon?, description?, obtainedAt }` 展示柜 |
| user_outfits | 衣柜（V1 空） |
| user_postcards | 图鉴 firstClaimed + claimCount |
| roof_stars | 屋顶星星 |
| trips | 旅行实例（含预抽明信片与投递时刻） |
| daily_purchases | UTC+8 每日限购 |
| idempotency | 幂等 |
| gm_audit | GM 日志 |
| asset_manifest | 资源 |

---

## `user_showcase`（展示柜）

| 字段 | 类型 | 含义 |
|------|------|------|
| userId | string | = openid |
| itemId | string | 对应 `items.id`，同用户唯一 |
| name / icon / description | string | 详情快照（缺省可读 items） |
| obtainedAt | number | 获得时间，列表升序 |
| source | string | trip / gacha / gm / shop |
| createdAt | number | |

规则：`items.type=souvenir` 或 `showcase=true` 可入库；同 itemId 不重复。  
API：`showcase/list`、`showcase/unlock`；Admin：`grantShowcase`。

建表与索引见 `cloud/db/README.md`。

---

## `game_config`（key=`trip`）

| 字段 | 类型 | 含义 | 建议默认 |
|------|------|------|----------|
| key | string | 固定 `trip` | |
| distanceMatchMul | number | 目的地距离档落在食物范围内时 × | 1.4 |
| distanceMissMul | number | 落在范围外时 × | 0.4 |
| riceDestMul | number | 携带米字星时目的地总分 × | 1.15 |
| ricePostcardMul | number | 携带米字星时明信片权重 × | 1.25 |
| riceRarityMul | object | 按稀有度额外 ×，如 `{ "SR":1.2,"SSR":1.35,"UR":1.5 }` | {} |
| secondPostcardRate | number | 抽到第 2 张明信片的基础概率 | 0.929 |
| riceSecondPostcardBonus | number | 带米字星时加在 second 概率上 | 0 |
| deliverAtMinRatio | number | 投递时刻相对行程比例下界 | 0.1 |
| deliverAtMaxRatio | number | 上界 | 0.9 |

代码回退：`POSTCARD_SECOND_RATE` 等常量。

---

## `items`

| 字段 | 适用 | 含义 |
|------|------|------|
| id, type, name, icon, description, enabled | 全类型 | 基础 |
| price, shopCategory, shopSort, dailyLimit | 商店 | 售卖 |
| durationMinH / durationMaxH | food | 出行时长范围（小时） |
| distanceMin / distanceMax | food | 匹配 `destinations.distanceTier` |
| postcardBias | food / prop | `[{ groupId, weight }]`，`weight` 为明信片权重乘数 |
| terrainBias | prop | `[{ tag, weightMul }]`，对目的地同 tag × |
| secondPostcardRateBonus | prop | 加在第二张明信片概率上（可负） |
| destWeightMul | prop | 携带时所有目的地分数再 × |

`type`: food | accessory | equipment | souvenir | rice_star  
商店道具槽：accessory + equipment。

---

## `destinations`

| 字段 | 含义 |
|------|------|
| id, name, enabled | |
| terrainTags | string[]，与道具 terrainBias.tag 对应 |
| distanceTier | number，与食物 distance 范围匹配 |
| baseWeight | 抽样基础权重（>0） |
| durationMinH / durationMaxH | 与食物时长取交集 |
| souvenirPool | itemId[]，归来抽 1 |

---

## `postcards`

| 字段 | 含义 |
|------|------|
| id, title, rarity, enabled | N/R/SR/SSR/UR |
| **type** | **展示类型**：`postcard` 标准明信片 / `letter` 手写信 / `photo` 照片 / `special` 活动限定 |
| groupId | 与 items.postcardBias.groupId 对应 |
| destId | 可选；等于本趟 dest 时额外 × `destMatchMul`（见下方引擎，默认 1.5，可写进 game_config） |
| **imageThumb** | **缩略切图** WebP 路径（日记格子、信箱列表） |
| **imageFull** | **主图** WebP 路径（点开放大） |
| story | 翻面故事 |
| baseWeight | 抽样基础权重（>0） |

成对规则：`imageThumb` 与 `imageFull` 在 `postcards` 配置表定义；写入 `trips.postcards[]` / `user_postcards` 时**快照两份**。  
缺省推导：仅配 `imageFull` 时，缩略图默认为 `{imageFull}-thumb`。

`game_config.trip.destMatchMul`：明信片绑定目的地命中时乘数，默认 1.5。

---

## `trips`（出行写库）

```
{
  userId, status: traveling|returned|at_home,
  loadout: { bento, riceStar?, props? },
  destId, destName,
  startAt, endAt,
  usedRiceStar,
  postcards: [{
    instanceId, postcardId, type, status: pending|delivered|claimed,
    deliverAt, title, rarity, groupId, imageThumb, imageFull, story
  }],
  souvenirs: [],
  createdAt
}
```

抽样在 `trip/start` **服务端一次完成**；途中只推进 status，不再重抽。

---

## 抽样公式（服务端）

```
score(dest) = dest.baseWeight
            * (tier in food.range ? distanceMatchMul : distanceMissMul)
            * Π prop.terrainBias[tag]
            * Π prop.destWeightMul
            * (rice ? riceDestMul : 1)

secondRate = clamp01(secondPostcardRate + Σ prop.bonus + (rice ? riceSecondBonus : 0))
n = 1 + (rand < secondRate ? 1 : 0)

score(card) = card.baseWeight
            * Π bias.weight for matching groupId (food+props)
            * (card.destId == dest.id ? destMatchMul : 1)
            * (rice ? ricePostcardMul * riceRarityMul[rarity] : 1)
```
