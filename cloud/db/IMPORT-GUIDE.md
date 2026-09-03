# 云开发控制台数据库导入指南

> 本目录下的文件由 `cloud/CLOUD-SETUP.md` + `cloud/collections.md` 自动生成。  
> 总配置表：`cloud/db/console-setup.json`

## 1. 创建集合（共 18 个）

登录 [微信云开发控制台](https://console.cloud.tencent.com/tcb) → 数据库 → **添加集合**，按下列名称逐一创建：

```
items
destinations
postcards
game_config
gacha_pool
copy_pool
asset_manifest
users
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
```

**权限统一选择：仅管理端可读写**（客户端通过云函数访问）。

## 2. 创建索引

在每个集合 → **索引管理** 中，按 `cloud/db/indexes.json` 或 `console-setup.json` 中的 `indexes` 字段创建对应索引。

重点索引（漏建会导致云函数报错）：

- `users`: `openid`（唯一）、`userId`（唯一）
- `items`: `id`（唯一）、`enabled + shopSort`
- `user_showcase`: `userId + itemId`（唯一）、`userId + obtainedAt`
- `user_inventory`: `userId + itemId`（唯一）
- `trips`: `userId + status`
- `daily_purchases`: `userId + itemId + dayKey`（唯一）
- `idempotency`: `key`（唯一）

## 3. 导入初始运营数据

对以下 6 个配置表，进入集合 → **导入**，选择对应文件：

| 集合 | 推荐导入文件（JSON Lines + `.json` 扩展名） |
|------|-------------------------------------------|
| `game_config` | `cloud/db/import/jsonl-json-ext/game_config.json` |
| `items` | `cloud/db/import/jsonl-json-ext/items.json` |
| `destinations` | `cloud/db/import/jsonl-json-ext/destinations.json` |
| `postcards` | `cloud/db/import/jsonl-json-ext/postcards.json` |
| `copy_pool` | `cloud/db/import/jsonl-json-ext/copy_pool.json` |
| `gacha_pool` | `cloud/db/import/jsonl-json-ext/gacha_pool.json` |

> 微信云开发控制台要求导入文件为 **JSON Lines 格式**（每行一条 JSON 记录），且通常要求 `.json` 扩展名。  
> `jsonl-json-ext/` 目录下的文件同时满足这两个要求：扩展名是 `.json`，内容是 JSON Lines。  
> 备用格式：
> - `cloud/db/import/jsonl/*.jsonl` —— JSON Lines 格式，`.jsonl` 扩展名
> - `cloud/db/import/json/*.json` —— JSON 数组格式，仅部分旧版控制台支持
>
> **注意**：若你已把美术资源放入 `miniprogram/assets/`，本 seed 中的 `items.icon` 和 `postcards.imageThumb/imageFull` 已同步更新为新的资源路径。导入后这些配置会指向本地图片。

## 4. 不要导入初始数据的集合

以下集合由游戏运行时写入，**请勿用 seed 覆盖**：

- `users`
- `user_inventory`
- `user_showcase`
- `user_outfits`
- `user_postcards`
- `user_gacha`
- `roof_stars`
- `trips`
- `daily_purchases`
- `idempotency`
- `gm_audit`
- `asset_manifest`（可选，有资源后再导入）

## 5. 下一步

1. 部署云函数（参考 `cloud/CLOUD-SETUP.md` 第 7 节）。
2. 配置环境变量 `ADMIN_SECRET` / `ADMIN_OPENIDS` / `GM_OPENIDS`。
3. 调用 `admin` 云函数的 `seedTripCatalog` action 完成运营配置写入（等价于本次手动导入，可任选一种方式）。
4. 为 `scheduler` 云函数配置定时触发器（建议每 5 分钟）。
