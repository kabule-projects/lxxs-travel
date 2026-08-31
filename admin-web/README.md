# 旅行小深内部工具

```bash
cd admin-web
cp .env.example .env
# 编辑 .env：填入 admin 云函数 HTTP 地址与 ADMIN_SECRET
npm install
npm run dev
```

## 功能（Sprint 0）

- 物品 CRUD（价格、时长/距离范围、品类）
- 目的地 CRUD（权重、地形、伴手礼池）

## 配置 admin HTTP

1. 微信云开发 → 云函数 `admin` → 开启 HTTP 访问
2. 复制 URL 到 `VITE_ADMIN_API_URL`
3. 云端设置 `ADMIN_SECRET`，与 `.env` 中 `VITE_ADMIN_SECRET` 一致

详见 `cloud/README.md`、`cloud/WHITELIST.md`。
