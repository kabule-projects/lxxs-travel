# 内部 Web 后台与 GM

独立仓库目录：`admin-web/`（Vite + React）。管理员白名单登录，不进小程序。

## MVP 页面
- 物品 CRUD（价格、范围、偏向、品类、上下架）
- 目的地 CRUD
- 明信片 CRUD + WebP 上传
- 扭蛋池（校验 V1 必须 food）
- 文案池（depart_farewell）
- 资源上传 + hash → manifest
- GM：查用户、改星星、改 pity、结束旅行（写 gm_audit）

## 保存校验
- durationMin ≤ durationMax，distanceMin ≤ distanceMax
- 权重 > 0
- 明信片必须有 thumb + full 两条 WebP
- gacha V1：`item.type === 'food'`

## 玩家不可见
催回、改星、改 pity 仅 GM。猫/桌/签到后台开关预留 V2。
