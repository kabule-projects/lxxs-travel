# 旅行小深

微信小程序挂机养成游戏。玩家扮演「米子」，为角色「深深」准备行李，等待其旅行归来，收获明信片与惊喜。

唯一货币是 **星星**。米字星是收藏品，不流通。

## 仓库结构

```
lxxs-travel/
├── miniprogram/          微信小程序客户端
├── cloud/functions/      云开发云函数
├── admin-web/            独立内部配置后台（Vite + React）
├── shared/               前后端共用常量和类型
├── docs/TECH-DESIGN.md   技术方案
├── PROGRESS.md           开发进度 Todo
└── .cursor/skills/       AI 开发 Skill / 算法 / Sprint 任务
```

## 技术栈

| 层 | 方案 |
|----|------|
| 小程序 | 原生 + TypeScript |
| 后端 | 微信云开发 CloudBase |
| 内部工具 | 独立 Web（Vite + React） |
| 设计基准 | iPhone 17 Pro Max 440×956 @3x（1320×2868） |

## 开发顺序

严格按 Sprint 0 → 8。见 `PROGRESS.md` 与 `.cursor/skills/shen-shen-travel/`。

在 Cursor 中实现某模块时，先读取对应 `sprints/sprint-XX-*.md` 和 `algorithms/*.md`。

## 本地打开

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本仓库根目录
2. 填写 `project.config.json` 的 `appid` 与 `setting.cloudEnv`（云环境 ID）
3. 或复制 `project.private.config.example.json` → `project.private.config.json` 并填写
4. 同步修改 `miniprogram/config/cloud.ts` 中的 `CLOUD_ENV_ID`
5. 云开发配置见 **[`cloud/CLOUD-SETUP.md`](./cloud/CLOUD-SETUP.md)**（集合、索引、云函数、环境变量、seed；交付验收清单）
6. 内部工具：`cd admin-web && cp .env.example .env && npm install && npm run dev`

## Sprint 0 验证

**小程序**
- 开发者工具编译通过，模拟器进入 Loading → 主页
- 配置云环境后，`login` 云函数写入 `users`
- 模拟低端机宽屏 / 低 DPR 可测 tollgate（真机；devtools 默认放行）

**admin-web**
- `npm run dev` 打开物品/目的地表单
- 配置 HTTP 后 CRUD 写入 `items` / `destinations`

**GM**
- 配置 `GM_OPENIDS` 后调用 `gm` 云函数 `action: ping`
