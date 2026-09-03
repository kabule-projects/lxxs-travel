# 旅行小深 · 技术方案

## 1. 产品闭环

`收集星星 → 商店买食物/道具 → 为深深打包 → 自发旅行（离线） → 途中寄明信片 / 归来伴手礼`

玩家不催回。背包无食物则不能出门。

## 2. 架构

```
小程序客户端  --HTTPS-->  云函数 Gateway
                              ├─ 鉴权（openid）
                              ├─ 游戏逻辑（roof/shop/trip/gacha/postcard）
                              ├─ 定时器 scheduler（星星追赶、明信片投递、旅行归来）
                              ├─ GM（白名单）
                              └─ admin HTTP（内部 Web）
独立 admin-web  --HTTPS-->  admin 云函数（管理员白名单）
云存储 COS：分层 PNG、明信片 WebP；私有读 + 短时签名 URL
```

## 3. 页面与路由

| 路由 | 说明 |
|------|------|
| pages/tollgate | 不支持机拦截 |
| pages/loading | 天台场景 + 动态框；预加载后进主页 |
| pages/home | 房间枢纽；深深静态图 |
| pages/roof | 与 Loading 同场景；捡星 + 未领明信片 |
| pages/shop | 上双人 coconono / 下 4 宫格 |
| pages/gacha | 单抽/五连 |
| pages/wardrobe | V1 空态 |
| pages/showcase | 9 宫格收藏 |
| pages/diary | 翻页书图鉴 |

弹窗组件：背包、购买确认、出行告别、展示柜详情。  
**不做**：签到页、桌子 UI、猫串门 UI（仅云函数 stub）。

主页跳转：商店 / 扭蛋 / 衣柜 / 展示柜 / 日记 / 屋顶；浮动背包。

## 4. 数据集合

见 `shared/types.ts`。核心集合：

- `users` openid, stars, riceStars, gm, pitySR/SSR/UR, currentTripId, lastSpawnAt, nextSpawnAt
- `items` 价格、时长/距离范围、postcardBias、terrainBias
- `destinations` 权重、地形、时长范围、伴手礼池
- `postcards` 五档稀有度、WebP 路径、故事
- `gacha_pool` V1 仅 food
- `user_inventory` / `user_showcase` / `user_outfits` / `user_postcards`
- `roof_stars` / `trips` / `daily_purchases` / `copy_pool` / `gm_audit`

## 5. API

| 方法 | 路径/云函数 | 说明 |
|------|-------------|------|
| login | 微信 code → 初始化用户 | |
| profile | 星星、旅行状态、pity | |
| roof/stars | 未收集星星 + 未领明信片 | |
| roof/collect | 收星 | |
| shop/items | page + tab | |
| shop/purchase | 幂等 + 每日限购 | |
| trip/start | 抽样目的地/时长/明信片 | |
| trip/current | 只读，无催回 | |
| postcard/claim | 领取；日记去重 | |
| diary/list | firstClaimed 图鉴 | |
| gacha/draw | count=1\|5 | |
| showcase/list | 9/页 | |
| wardrobe/list | V1 空 | |
| admin/* | 配置 CRUD | |
| gm/* | 改星、改 pity、结束旅行 | |
| stub/table, stub/checkin, stub/cat | V2 空实现 | |

## 6. 资源

- UI/角色/分层：PNG；明信片：WebP
- 主包仅 Loading 必需资源；其余 CDN 签名
- 按 pixelRatio 下发 2x/3x；manifest 带 hash
- 分层：天空/天台/家具/角色/热区，可动物单独一层

## 7. 适配

- 设计：440×956 @3x
- 白名单：iPhone 逻辑宽约 390–440；高端安卓 360–430 且 pixelRatio≥2.5
- 其它设备：tollgate
- 安全区：`wx.getWindowInfo().safeArea`；Pro Max 参考 top 62 / bottom 34

## 8. 版本

| 版本 | 范围 |
|------|------|
| MVP | 屋顶、商店、背包、旅行、明信片、扭蛋、展示柜、衣柜 |
| V2 | 桌子、签到、猫接口落地、服装影响明信片、多设备同步 |
| V3 | 分享、订阅消息、活动 |

## 9. 算法入口

`.cursor/skills/shen-shen-travel/algorithms/`
