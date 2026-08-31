# 出行目录 Seed



源文件：`trip-catalog.json`（含 `game_config` / `items` / `destinations` / `postcards` / `copy_pool`）。



## 导入方式



1. 云开发控制台创建集合：`game_config`、`items`、`destinations`、`postcards`、`copy_pool`（若尚未创建）。

2. 部署 `admin` + `common` 云函数（seed 在 `common/seed/`）。

3. 调用 admin：



```json

{ "action": "seedTripCatalog", "adminSecret": "<你的密钥>" }

```



可重复执行：按 `id`/`key` upsert。



## 调概率



- 全局：改 `game_config` 中 `key=trip` 文档  

- 单物品：改 `items` 的 bias / bonus  

- 目的地：改 `destinations.baseWeight`  

- 明信片：改 `postcards.baseWeight` / `groupId` / `destId`


