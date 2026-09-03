# 旅行小深 · 云端配置详细手册

> **交付与联调以本文为准**。按章节顺序执行，完成一节勾一节。  
> 字段语义见 [`collections.md`](./collections.md)；接口速查见 [`db/API-MAP.md`](./db/API-MAP.md)。

---

## 目录

1. [概述](#1-概述)
2. [总览检查清单](#2-总览检查清单)
3. [微信小程序与云开发环境](#3-微信小程序与云开发环境)
4. [修改工程配置](#4-修改工程配置)
5. [数据库：创建集合](#5-数据库创建集合)
6. [数据库：创建索引](#6-数据库创建索引)
7. [云函数部署](#7-云函数部署)
8. [环境变量](#8-环境变量)
9. [scheduler 定时触发器](#9-scheduler-定时触发器)
10. [admin HTTP 与内部后台](#10-admin-http-与内部后台)
11. [导入运营配置（seed）](#11-导入运营配置seed)
12. [扭蛋奖池配置](#12-扭蛋奖池配置)
13. [云存储与资源 manifest（可选）](#13-云存储与资源-manifest可选)
14. [云函数 API 参考](#14-云函数-api-参考)
15. [联调验收流程](#15-联调验收流程)
16. [故障排查](#16-故障排查)
17. [安全与维护约定](#17-安全与维护约定)
18. [相关文档索引](#18-相关文档索引)

---

## 1. 概述

| 项目 | 说明 |
|------|------|
| 后端 | 微信云开发 CloudBase |
| 数据库 | 云数据库（客户端**不直连**，仅云函数读写） |
| 计算 | 云函数 `cloud/functions/` |
| 运营 | 独立 Web `admin-web/` → 调用 `admin` 云函数 HTTP |
| 权限模型 | 所有集合建议 **仅管理端可读写** |

### 未配置云环境时的行为

`miniprogram/config/cloud.ts` 中 `CLOUD_ENV_ID` 仍为占位值 `lxxs-cloud-env-placeholder` 时：

- 小程序 **跳过云登录**
- 屋顶 / 商店 / 扭蛋等走 **本地 storage 回退**
- **不等于云端已通**，无法进行真实多设备联调

---

## 2. 总览检查清单

复制到协作工具中逐项打勾：

```
阶段 A · 环境与工程
[ ] A1 已注册小程序，拿到 AppID
[ ] A2 已开通云开发环境，记下环境 ID（形如 lxxs-xxxxx）
[ ] A3 project.config.json 已填 appid、cloudEnv
[ ] A4 miniprogram/config/cloud.ts 已填 CLOUD_ENV_ID
[ ] A5 开发者工具「云开发」面板能正常打开该环境

阶段 B · 数据库
[ ] B1 已创建全部 18 个集合（名称完全一致）
[ ] B2 全部集合权限为「仅管理端可读写」
[ ] B3 已按第 6 节创建全部索引

阶段 C · 云函数
[ ] C1 已上传并部署全部云函数（含 common 依赖）
[ ] C2 已勾选「云端安装依赖」
[ ] C3 已配置环境变量 ADMIN_SECRET / ADMIN_OPENIDS / GM_OPENIDS
[ ] C4 scheduler 已配置定时触发器（建议每 5 分钟）
[ ] C5 admin 已开启 HTTP 访问（若使用 admin-web）

阶段 D · 数据导入
[ ] D1 已调用 seedTripCatalog 导入出行/商店/明信片配置
[ ] D2 已手动导入 gacha_pool 奖池数据
[ ] D3 （可选）已上传 WebP 并写入 asset_manifest

阶段 E · 验收
[ ] E1 真机完成昵称授权，users 有文档且含 userId(UUID)
[ ] E2 屋顶 sync/collect 正常
[ ] E3 商店购买扣星、限购生效
[ ] E4 背包出发 → 旅行 → 明信片信箱 → 日记去重
[ ] E5 扭蛋扣星、保底、重复转 1 星
[ ] E6 展示柜翻页、衣柜空态
```

---

## 3. 微信小程序与云开发环境

### 3.1 注册小程序

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **小程序** → 开发管理 → 开发设置
3. 复制 **AppID**（形如 `wxXXXXXXXX`）

### 3.2 开通云开发

1. 微信开发者工具打开本仓库根目录
2. 顶部菜单 **云开发** → **开通**（按量计费或套餐）
3. 创建环境（建议单独建 `dev` / `prod`）
4. 在云开发控制台 → **设置** → 复制 **环境 ID**

### 3.3 开发者工具建议设置

| 项 | 建议 |
|----|------|
| 详情 → 本地设置 | 按需勾选「不校验合法域名」（仅开发期） |
| 云开发 → 云函数 | 默认环境选为目标环境 |
| 真机调试 | 使用体验版或开发版扫码，确认 openid 与开发者工具一致 |

---

## 4. 修改工程配置

### 4.1 必改文件

| 文件 | 字段 | 示例 |
|------|------|------|
| `project.config.json` | `appid` | `wxYOUR_APPID` |
| `project.config.json` | `setting.cloudEnv` | `lxxs-prod-xxxxx` |
| `miniprogram/config/cloud.ts` | `CLOUD_ENV_ID` | 同上环境 ID |

**示例 `project.config.json` 片段：**

```json
{
  "appid": "wxYOUR_APPID",
  "setting": {
    "cloudEnv": "lxxs-prod-xxxxx"
  }
}
```

**示例 `miniprogram/config/cloud.ts`：**

```ts
export const CLOUD_ENV_ID = 'lxxs-prod-xxxxx';
```

### 4.2 可选：私有配置（勿提交密钥）

可复制 `project.private.config.json.example`（若仓库提供）为 `project.private.config.json`，仅本地保存 `cloudEnv`，加入 `.gitignore`。

### 4.3 验证配置生效

1. 重新编译小程序
2. `App.onLaunch` 会执行 `wx.cloud.init({ env: CLOUD_ENV_ID })`
3. 控制台无 `login skipped` 警告
4. 云开发面板 → 数据库 → 调用 `login` 后 `users` 出现新文档

---

## 5. 数据库：创建集合

**路径：** 云开发控制台 → 数据库 → **添加集合**

**权限：** 全部选 **仅管理端可读写**（客户端经云函数访问）。

### 5.1 集合列表（共 18 个，名称必须完全一致）

#### 配置表（可用 seed / admin 导入）

| # | 集合名 | 用途 |
|---|--------|------|
| 1 | `items` | 商店物品、背包、伴手礼、展示柜文案与出行权重 |
| 2 | `destinations` | 目的地权重、时长、伴手礼池 |
| 3 | `postcards` | 明信片权重、故事、图片路径 |
| 4 | `game_config` | 全局概率旋钮（`key=trip` 等） |
| 5 | `gacha_pool` | 扭蛋奖池（独立于 items） |
| 6 | `copy_pool` | 告别语、商店台词等文案 |
| 7 | `asset_manifest` | 云存储 / CDN 资源索引 |

#### 玩家进度表（运行时写入，禁止 seed 覆盖）

| # | 集合名 | 用途 |
|---|--------|------|
| 8 | `users` | 玩家档案：userId、openid、星星、米字星、pity、旅行状态 |
| 9 | `user_inventory` | 背包数量 |
| 10 | `user_showcase` | 展示柜 |
| 11 | `user_outfits` | 衣柜（V1 空） |
| 12 | `user_postcards` | 日记图鉴（firstClaimed 去重） |
| 13 | `user_gacha` | 扭蛋图鉴已获得记录 |
| 14 | `roof_stars` | 屋顶星星（pending / dropped） |
| 15 | `trips` | 旅行实例、途中明信片投递时刻 |

#### 系统表

| # | 集合名 | 用途 |
|---|--------|------|
| 16 | `daily_purchases` | UTC+8 商店每日限购 |
| 17 | `idempotency` | 购买 / 出行 / 扭蛋幂等 |
| 18 | `gm_audit` | GM 操作审计日志 |

### 5.2 一键复制（控制台批量创建）

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

### 5.3 字段样例

每集合示例文档见 `cloud/db/schemas/*.json`。  
概率与业务字段语义见 [`collections.md`](./collections.md)。

**`users` 核心字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | string | UUID，业务用户 ID，唯一 |
| openid | string | 微信 openid，唯一 |
| nickName / avatarUrl | string | 授权后写入 |
| profileAuthorized | boolean | 是否完成初次授权 |
| stars | number | 星星余额 |
| riceStars | number | 米字星收藏数 |
| pitySR / pitySSR / pityUR | number | 扭蛋三档保底计数 |
| currentTripId | string\|null | 当前旅行 docId |
| nextSpawnAt | number | 下一颗屋顶星生成时刻 |
| lastMailboxOpenAt | number? | 上次打开信箱（清叼信） |

---

## 6. 数据库：创建索引

**路径：** 云开发控制台 → 数据库 → 选中集合 → **索引管理**

机读清单：`cloud/db/indexes.json`（与下表一致）。

| 集合 | 索引字段 | 唯一 | 用途 |
|------|----------|------|------|
| users | openid ↑ | 是 | 登录查询 |
| users | userId ↑ | 是 | 业务 ID 查询 |
| items | id ↑ | 是 | 物品查询 |
| items | enabled ↑, shopSort ↑ | 否 | 商店列表排序 |
| destinations | id ↑ | 是 | |
| destinations | enabled ↑ | 否 | 出行抽样 |
| postcards | id ↑ | 是 | |
| postcards | enabled ↑ | 否 | |
| game_config | key ↑ | 是 | trip 配置 |
| user_inventory | userId ↑, itemId ↑ | 是 | 背包 |
| user_showcase | userId ↑, itemId ↑ | 是 | 展示柜去重 |
| user_showcase | userId ↑, obtainedAt ↑ | 否 | 列表排序（**必建**） |
| user_postcards | userId ↑, postcardId ↑ | 是 | 日记去重 |
| user_outfits | userId ↑, outfitId ↑ | 是 | 衣柜 |
| user_gacha | userId ↑, gachaId ↑ | 是 | 扭蛋图鉴去重 |
| roof_stars | userId ↑, status ↑ | 否 | 屋顶 sync |
| trips | userId ↑, status ↑ | 否 | 当前旅行查询 |
| daily_purchases | userId ↑, itemId ↑, dayKey ↑ | 是 | 每日限购 |
| idempotency | key ↑ | 是 | 幂等 |
| copy_pool | type ↑, enabled ↑ | 否 | 文案池 |
| gacha_pool | enabled ↑ | 否 | 奖池列表 |
| asset_manifest | path ↑ | 是 | 资源路径 |

> CloudBase 对 `orderBy` 字段通常要求索引；漏建会导致云函数报索引错误。

---

## 7. 云函数部署

### 7.1 目录结构

```
cloud/functions/
  common/           公共模块 + seed/trip-catalog.json
  login/            登录 / 注册
  manifest/         资源清单
  roof/             屋顶星星
  shop/             商店
  inventory/        背包
  trip/             出行 / 同步 / 回家
  postcard/         信箱 / 日记
  showcase/         展示柜
  wardrobe/         衣柜
  gacha/            扭蛋
  scheduler/        定时推进旅行
  admin/            运营 CRUD + seed
  gm/               GM 工具
  stubTable/        V2 占位
  stubCheckin/      V2 占位
  stubCat/          V2 占位
```

### 7.2 部署步骤（微信开发者工具）

1. 确认 `project.config.json` 中 `cloudfunctionRoot` 为 `cloud/functions/`
2. 左侧 **云开发** → **云函数**
3. 对每个函数目录 **右键 → 上传并部署：云端安装依赖**
4. **必须部署的函数**（MVP）：

| 函数 | 必须 | 说明 |
|------|------|------|
| login | ✅ | 登录建用户 |
| roof | ✅ | 屋顶星星 |
| shop | ✅ | 商店 |
| inventory | ✅ | 背包 |
| trip | ✅ | 出行 |
| postcard | ✅ | 信箱 / 日记 |
| showcase | ✅ | 展示柜 |
| wardrobe | ✅ | 衣柜 |
| gacha | ✅ | 扭蛋 |
| scheduler | ✅ | 需配触发器 |
| admin | ✅ | seed + 运营 |
| gm | 建议 | 测试加星 |
| manifest | 可选 | 云存储资源 |
| stub* | 可选 | V2 占位 |

5. `common` 不需单独上传，但各函数 `require('../common/...')` 时须保证上传包内含 common 目录（整包上传默认包含）

### 7.3 部署后冒烟测试

在云开发控制台 → 云函数 → 选中函数 → **云端测试**：

**login：**

```json
{ "action": "ping" }
```

期望：`{ "ok": true, "data": { "service": "login", ... } }`

**admin（需密钥，见第 8 节）：**

```json
{ "action": "ping", "adminSecret": "你的ADMIN_SECRET" }
```

---

## 8. 环境变量

**路径：** 云开发控制台 → 云函数 → **版本与配置** → **环境变量**

建议挂在 **admin**、**gm** 函数（或环境级全局变量，视控制台能力而定）。

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `ADMIN_SECRET` | **是** | admin / admin-web 调用密钥 | 32 位以上随机串 |
| `ADMIN_OPENIDS` | 生产建议 | 管理员 openid，逗号分隔 | `oABC,oDEF` |
| `GM_OPENIDS` | 可选 | GM openid；缺省同 ADMIN | `oABC` |

详见 [`WHITELIST.md`](./WHITELIST.md)。

### 8.1 获取 openid

1. 配置好环境 ID，真机或模拟器运行小程序
2. 完成 `login` 授权
3. 云开发 → 数据库 → `users` → 查看 `openid` 字段

### 8.2 鉴权逻辑摘要

| 函数 | 鉴权方式 |
|------|----------|
| admin | `adminSecret === ADMIN_SECRET` **或** 调用者 openid ∈ ADMIN_OPENIDS |
| gm | 调用者 openid ∈ GM_OPENIDS（列表为空时仅校验已登录） |
| 其他业务函数 | 微信云函数自动注入 OPENID |

---

## 9. scheduler 定时触发器

**作用：** 批量推进 `traveling` 行程——明信片到点投递、旅行到期变为 `returned`、发放伴手礼。

### 9.1 配置步骤

1. 云开发控制台 → 云函数 → **scheduler**
2. **触发器** → **添加触发器**
3. 推荐配置：

| 项 | 值 |
|----|-----|
| 触发周期 | 自定义 / Cron |
| Cron 表达式 | `0 */5 * * * * *`（每 5 分钟，以控制台语法为准） |
| 触发器名称 | `trip-advance` |

> 不同控制台版本 Cron 字段数可能为 5 位或 6 位，选 **每 5 分钟** 即可。

### 9.2 验证

手动触发一次 scheduler，检查返回：

```json
{
  "ok": true,
  "data": {
    "service": "scheduler",
    "processed": 0,
    "returned": 0,
    "delivered": 0
  }
}
```

有进行中旅行时，`processed` / `delivered` / `returned` 应 > 0。

---

## 10. admin HTTP 与内部后台

### 10.1 开启 HTTP 访问

1. 云开发控制台 → 云函数 → **admin**
2. **HTTP 访问** → 开启
3. 复制 **HTTP 访问地址**（形如 `https://xxxx.service.tcloudbase.com/admin`）

### 10.2 配置 admin-web

```bash
cd admin-web
cp .env.example .env
```

编辑 `.env`：

```env
VITE_ADMIN_API_URL=https://你的admin-HTTP地址
VITE_ADMIN_SECRET=与云端ADMIN_SECRET完全一致
```

启动：

```bash
npm install
npm run dev
```

### 10.3 admin 主要 action

| action | 说明 |
|--------|------|
| `seedTripCatalog` | 导入出行/商店/明信片/文案配置 |
| `grantShowcase` | 给指定 openid 写入展示柜（联调用） |
| `listItems` / `createItem` / `updateItem` / `deleteItem` | 物品 CRUD |
| `listDestinations` / `createDestination` / … | 目的地 CRUD |
| `listManifest` / `upsertManifest` | 资源 manifest |
| `getSignedUrl` | 云存储临时 URL |

所有请求体格式：

```json
{
  "action": "动作名",
  "adminSecret": "你的ADMIN_SECRET",
  "payload": { }
}
```

---

## 11. 导入运营配置（seed）

### 11.1 seedTripCatalog

**前置：** 已建集合 + 已部署 `admin` + `common` + 已设 `ADMIN_SECRET`

**云函数测试调用：**

```json
{
  "action": "seedTripCatalog",
  "adminSecret": "你的ADMIN_SECRET"
}
```

**写入集合：** `game_config`、`items`、`destinations`、`postcards`、`copy_pool`  
**源文件：** `cloud/seed/trip-catalog.json`（云函数内副本：`common/seed/trip-catalog.json`）  
**特性：** 可重复执行，按 `id` / `key` upsert，不会覆盖玩家数据。

**期望返回：**

```json
{
  "ok": true,
  "data": {
    "seeded": true,
    "summary": {
      "game_config": 1,
      "items": 12,
      "destinations": 5,
      "postcards": 8,
      "copy_pool": 4
    }
  }
}
```

### 11.2 grantShowcase（联调可选）

给测试账号预置展示柜展品：

```json
{
  "action": "grantShowcase",
  "adminSecret": "你的ADMIN_SECRET",
  "payload": {
    "openid": "oXXXX测试号openid",
    "itemIds": ["souvenir_potato", "souvenir_leaf", "souvenir_badge"]
  }
}
```

### 11.3 GM 加星（联调可选）

调用 **gm** 云函数（调用者 openid 须在 GM_OPENIDS）：

```json
{
  "action": "setStars",
  "payload": {
    "openid": "oXXXX",
    "stars": 99
  }
}
```

其他 GM action：`getUser`、`setPity`、`endTrip`（强制结束旅行）。

---

## 12. 扭蛋奖池配置

`gacha` 云函数从 `gacha_pool` 读权重，**不包含在 seedTripCatalog 内**，需单独导入。

### 12.1 手动导入（控制台）

1. 打开 `cloud/seed/gacha-pool.json`
2. 云开发 → 数据库 → `gacha_pool` → **导入**
3. 或逐条 **添加记录**，字段示例：

```json
{
  "gachaId": "gacha_potato",
  "name": "烤土豆",
  "icon": "",
  "rarity": "N",
  "weight": 120,
  "sortOrder": 1,
  "enabled": true
}
```

### 12.2 验证

调用 `gacha` 云函数：

```json
{ "action": "catalog" }
```

应返回奖池列表；再测：

```json
{ "action": "draw", "count": 1, "requestId": "test-001" }
```

---

## 13. 云存储与资源 manifest（可选）

有美术资源后：

1. 上传 WebP 到云存储（建议路径与 `miniprogram/utils/asset-path.ts` 一致，含 `@2x` / `@3x`）
2. 在 `asset_manifest` 写入条目，或通过 admin：

```json
{
  "action": "upsertManifest",
  "adminSecret": "你的ADMIN_SECRET",
  "payload": {
    "path": "home/room",
    "hash": "sha256...",
    "w": 1320,
    "h": 2868,
    "dpr": [2, 3]
  }
}
```

3. 小程序经 `manifest` 云函数 `list` / `getSignedUrl` 拉取

本地开发期可继续使用 `miniprogram/assets/` 占位路径。

---

## 14. 云函数 API 参考

### 14.1 页面 ↔ 云函数对照

| 页面 / 能力 | 云函数 | action | 依赖集合 |
|-------------|--------|--------|----------|
| 启动登录 | login | session / register | users |
| 授权注册 | login | register | users |
| Loading 资源 | manifest | list / getSignedUrl | asset_manifest |
| 屋顶星星 | roof | sync / collect | users, roof_stars |
| 商店 | shop | list / purchase / talk | items, users, user_inventory, daily_purchases, idempotency, copy_pool |
| 背包 | inventory | list | user_inventory, items |
| 出行 | trip | start / sync / claimHome / farewell | trips, users, items, destinations, postcards, game_config, user_inventory, user_showcase, copy_pool, idempotency |
| 鸽子信箱 | postcard | mailbox / openMailbox / markSeen / claim | trips, user_postcards, users |
| 日记 | postcard | diary | user_postcards, postcards |
| 展示柜 | showcase | list / unlock | user_showcase, items |
| 衣柜 | wardrobe | list | user_outfits |
| 扭蛋 | gacha | catalog / draw | gacha_pool, user_gacha, users |
| 定时 | scheduler | （触发器，无 action） | trips, users, … |
| 运营 | admin | 见第 10.3 节 | 配置表 |
| GM | gm | setStars / endTrip / … | users, trips, gm_audit |

### 14.2 关键业务参数摘要

**roof.sync** — 返回 `{ stars, riceStars, pending[], dropped[], nextSpawnAt }`  
空中星最多 5，地上最多 20，间隔 10min–2h 随机。

**shop.purchase** — 需 `itemId`、`requestId`（幂等）；UTC+8 每物品每日限购 1。

**trip.start** — 需 `loadout`（bento / riceStar / props）、`requestId`；服务端权重抽样目的地与明信片。

**postcard.mailbox** — 未读最多 5 封，超限旧信自动已读进日记；按 `deliverAt` 降序。

**gacha.draw** — `count` 为 1 或 5；五连 25 星无折扣；保底 10/100/200 三档独立。

---

## 15. 联调验收流程

按顺序在 **真机** 执行（云环境已配置）：

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| 1 | 首次打开 → 授权昵称头像 | `users` 有记录，`userId` 为 UUID |
| 2 | 进入屋顶，等待或 GM 加星 | `roof_stars` 有 pending/dropped |
| 3 | 收取地上星星 | `users.stars` 增加，普通星顶栏 +1 |
| 4 | 商店购买 | 扣星、`daily_purchases` 有记录、背包有物 |
| 5 | 准备 → 背包 → 出发 | `trips` status=traveling，角色提示条 |
| 6 | 等待 scheduler 或 GM endTrip | 明信片投递、`postcard.mailbox` 有未读 |
| 7 | 点开鸽子信箱 → 领取 | `user_postcards` 去重，日记可见 |
| 8 | 扭蛋单抽/五连 | 扣星、pity 递增、重复转 1 星 |
| 9 | 展示柜 / 衣柜 / 设置 | 各页正常、设置显示 userId |

---

## 16. 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 控制台 `[app] login skipped` | `CLOUD_ENV_ID` 仍为占位 | 改 `cloud.ts` + `project.config.json` |
| 云函数报「集合不存在」 | 漏建集合 | 对照第 5 节补建 |
| 云函数报索引错误 | 漏建索引 | 对照第 6 节补建 |
| 商店/背包为空 | 未 seed | 执行 `seedTripCatalog` |
| 扭蛋无奖品 | `gacha_pool` 为空 | 按第 12 节导入 |
| 旅行不归来、明信片不投递 | scheduler 未配触发器 | 第 9 节 |
| admin-web 403 | SECRET 不一致或 openid 不在白名单 | 第 8 节 |
| 屋顶一直本地数据 | 云函数未部署或 login 失败 | 检查部署与 users |
| 购买/出行重复扣费 | 幂等 key 冲突 | 查 `idempotency` 集合 |

**查看云函数日志：** 云开发控制台 → 云函数 → 选择函数 → 日志。

---

## 17. 安全与维护约定

1. **生产环境** 必须配置 `ADMIN_OPENIDS`，不要仅依赖 `ADMIN_SECRET`
2. `ADMIN_SECRET` 使用强随机串，勿提交到 Git
3. 概率、货架、目的地、明信片：**只改库表或走 admin**，不在云函数写死新魔法数
4. 玩家表（`users` / `user_*` / `trips` / `roof_stars`）**禁止**用 seed 整表覆盖
5. 新增集合或云函数时，同步更新：本文 + `db/API-MAP.md` + `db/indexes.json` + `PROGRESS.md`

---

## 18. 相关文档索引

| 文档 | 内容 |
|------|------|
| **本文** `cloud/CLOUD-SETUP.md` | 云端配置详细手册（交付用） |
| `cloud/db/README.md` | 建表 / 索引摘要 |
| `cloud/db/indexes.json` | 索引机读清单 |
| `cloud/db/schemas/` | 各集合字段示例 |
| `cloud/db/API-MAP.md` | 页面 ↔ 云函数速查 |
| `cloud/collections.md` | 字段语义与概率公式 |
| `cloud/seed/README.md` | trip-catalog seed 说明 |
| `cloud/seed/gacha-pool.json` | 扭蛋奖池样例 |
| `cloud/WHITELIST.md` | ADMIN / GM 白名单 |
| `cloud/README.md` | 云函数部署简述 |
| `admin-web/README.md` | 内部运营后台 |

---

*文档版本：2026-08-31 · 集合数 18（含 user_gacha）*
