# 已上线页面 ↔ 云函数对照

部署时请上传下列云函数（`cloud/functions/`）。

| 页面/能力 | 云函数 | action | 依赖集合 |
|-----------|--------|--------|----------|
| 启动/登录 | `login` | session / register | users（userId+openid 唯一） |
| Loading 资源 | `manifest` | list / getSignedUrl | asset_manifest |
| 屋顶星星 | `roof` | sync / collect | users, roof_stars |
| 商店 | `shop` | list / purchase / talk | items, users, user_inventory, daily_purchases, idempotency, copy_pool |
| 背包选物 | `inventory` | list | user_inventory, items, users |
| 出发/同步/回家 | `trip` | start / sync / claimHome / farewell | trips, users, items, destinations, postcards, game_config, user_inventory, user_showcase, copy_pool, idempotency |
| 明信片/日记 | `postcard` | mailbox / openMailbox / markSeen / claim / diary | trips, user_postcards, users |
| 展示柜 | `showcase` | list / unlock | user_showcase, items |
| 衣柜 V1 | `wardrobe` | list | user_outfits |
| 定时推进 | `scheduler` | （触发器） | trips, users, … |
| 运营导入 | `admin` | seedTripCatalog / grantShowcase / CRUD | 配置表 |
| GM | `gm` | setStars / endTrip … | users, trips, gm_audit |
| V2 占位 | stubTable / stubCheckin / stubCat | ping | — |

| 扭蛋 | `gacha` | catalog / draw | gacha_pool, user_gacha, users |

## 云端一次性步骤

1. 按 `cloud/db/README.md` 建 **18** 个集合 + 索引  
2. 部署上表云函数（含 `common`）  
3. `admin/seedTripCatalog` 导入配置  
4. （可选）`admin/grantShowcase` 塞展品；商店购买或 GM 加星后测全链路  
5. 为 `scheduler` 配定时触发器（建议 5 分钟）
