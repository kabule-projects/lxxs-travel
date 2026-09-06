# 云函数部署说明

> **云端配置总手册（交付用）** → [`CLOUD-SETUP.md`](./CLOUD-SETUP.md)  
> 建表/索引摘要 → [`db/README.md`](./db/README.md) · 接口对照 → [`db/API-MAP.md`](./db/API-MAP.md)

## 目录结构

```
cloud/functions/
  common/          公共模块 + seed/
  login/           登录初始化 users
  admin/           内部后台 CRUD + seedTripCatalog + grantShowcase
  gm/              GM 操作
  manifest/        公开只读 manifest + 签名 URL
  roof shop trip postcard gacha showcase scheduler/
  stubTable stubCheckin stubCat/   V2 占位
```

## 数据库

先按 `cloud/db/README.md` 建 18 个集合与索引，再调 `seedTripCatalog` 导入运营配置。
字段样例：`cloud/db/schemas/`。

## 公共模块引用

各云函数通过 `require('./common/xxx')` 引用（common 被物理复制进每个函数目录）。

**上传任何云函数前，先在项目根目录运行：**

```bash
node scripts/sync-cloud-common.js
```

原因：微信开发者工具上传云函数时只打包该函数自己的目录，`../common` 形式的引用
在云端会报 `Cannot find module`。common 副本由脚本生成、已 gitignore，不要手改。

`common` 目录本身**不是云函数**（无入口文件），不要上传——上传会卡在 CreateFailed 状态。

推荐：云开发控制台 → 云函数 → 开启「云端安装依赖」。

## 环境变量（云函数配置）

| 变量 | 说明 |
|------|------|
| `ADMIN_OPENIDS` | 管理员 openid，逗号分隔 |
| `GM_OPENIDS` | GM openid，逗号分隔（默认同 ADMIN） |
| `ADMIN_SECRET` | admin-web HTTP 调用密钥 |

## admin HTTP 触发

1. 云开发控制台为 `admin` 开启 HTTP 访问
2. 将 URL 填入 `admin-web/.env` 的 `VITE_ADMIN_API_URL`
3. `VITE_ADMIN_SECRET` 与云端 `ADMIN_SECRET` 一致

## 本地 admin-web

```bash
cd admin-web && npm install && npm run dev
```

未配置 API 时界面可浏览，保存会提示配置缺失。
