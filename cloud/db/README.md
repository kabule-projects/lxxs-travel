# 云数据库建表清单（控制台照抄）

在微信云开发 → 数据库 → 新建集合，**集合名必须与下表完全一致**。  
权限建议：所有集合选「仅管理端可读写」（由云函数访问）。

## 1. 集合名列表（一次性建完）

```
users
items
destinations
postcards
game_config
gacha_pool
copy_pool
user_inventory
user_showcase
user_outfits
user_postcards
user_gacha
roof_stars
trips
daily_purchases
idempotency
gm_audit
asset_manifest
```

共 **18** 个。

## 2. 推荐索引（控制台 → 索引管理）

| 集合 | 索引字段 | 类型 | 用途 |
|------|----------|------|------|
| users | openid | 唯一 | 登录 |
| users | （字段）lastMailboxOpenAt | — | 点开信箱清叼信 |
| items | id | 唯一 | 物品查询 |
| items | enabled + shopSort | 组合 | 商店列表 |
| destinations | id | 唯一 | |
| destinations | enabled | 单字段 | 出行抽样 |
| postcards | id | 唯一 | |
| postcards | enabled | 单字段 | |
| game_config | key | 唯一 | trip 配置 |
| user_inventory | userId + itemId | 唯一组合 | 背包 |
| user_showcase | userId + itemId | 唯一组合 | 展示柜去重 |
| user_showcase | userId + obtainedAt | 组合 | 列表排序 |
| user_postcards | userId + postcardId | 唯一组合 | 日记去重 |
| user_outfits | userId + outfitId | 唯一组合 | 衣柜 |
| user_gacha | userId + gachaId | 唯一组合 | 扭蛋图鉴 |
| roof_stars | userId + status | 组合 | 屋顶 |
| trips | userId + status | 组合 | 当前旅行 |
| daily_purchases | userId + itemId + dayKey | 唯一组合 | 限购 |
| idempotency | key | 唯一 | 幂等 |
| copy_pool | type + enabled | 组合 | 文案 |
| gacha_pool | enabled | 单字段 | |
| asset_manifest | path | 唯一 | |

> CloudBase 对 `orderBy` 的字段通常需要索引；`user_showcase` 的 `obtainedAt` 排序务必建好。

## 3. 导入配置数据

1. 部署云函数 `admin` + `common`（含 `common/seed/trip-catalog.json`）
2. 调用：

```json
{ "action": "seedTripCatalog", "adminSecret": "你的密钥" }
```

3. 完整页面↔接口对照见 [`API-MAP.md`](./API-MAP.md)。  
   会写入：`game_config`、`items`（含伴手礼 souvenir）、`destinations`、`postcards`、`copy_pool`。

4. （可选）给自己塞测试展品：

```json
{
  "action": "grantShowcase",
  "adminSecret": "你的密钥",
  "payload": { "openid": "玩家openid", "itemIds": ["souvenir_potato", "souvenir_leaf"] }
}
```

## 5. 文件说明

| 路径 | 内容 |
|------|------|
| `cloud/collections.md` | 字段语义与概率公式 |
| `cloud/db/schemas/*.json` | 每集合字段说明 + 示例文档（导入参考） |
| `cloud/db/indexes.json` | 索引清单机读版 |
| `cloud/seed/trip-catalog.json` | 可运营配置种子 |

玩家进度类集合（`users` / `user_*` / `trips` / `roof_stars` 等）**不要**用 seed 覆盖，由游戏运行时写入。
