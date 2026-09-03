# 管理员 / GM 白名单

在云开发控制台 → 云函数 → 环境变量 中配置：

```
ADMIN_OPENIDS=oxxxx1,oxxxx2
GM_OPENIDS=oxxxx1
ADMIN_SECRET=请改为强随机字符串
```

`admin-web` 的 `VITE_ADMIN_SECRET` 需与 `ADMIN_SECRET` 一致。

未配置 openid 白名单时，仅 `adminSecret` 正确可通过 admin 校验（便于 Sprint 0 联调）。  
生产环境务必配置 `ADMIN_OPENIDS`。

获取 openid：小程序调用 `login` 云函数后，在 `users` 集合查看。
