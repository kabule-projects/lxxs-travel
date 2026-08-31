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

各云函数通过 `require('../common/xxx')` 引用。  
在微信开发者工具中上传云函数时，请**整包上传** `cloud/functions` 根目录，或分别为每个函数安装公共模块。

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
