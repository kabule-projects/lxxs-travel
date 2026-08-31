# 资源、安全与设备适配

## 格式
- **全部图片统一 WebP**（UI / 角色 / 场景 / 道具 / 明信片 / Loading 按钮与进度条）
- 音效：短 AAC/M4A，无 BGM

## 资源路径
- 使用 `miniprogram/utils/asset-path.ts`：`assetWebp()`、`assetWebpCandidates()`、`preloadFirstAvailable()`
- 命名：`{name}@3x.webp`、`{name}@2x.webp`、回退 `{name}.webp`
- DPR ≥ 2.75 优先 @3x，否则 @2x

## 包体
- 主包只放 Loading 必需 WebP、tollgate
- 其余云存储私有读 + 5–15 分钟签名 URL
- manifest：`{ path, hash, w, h, dpr:[2,3] }`，下载后校验 hash

## 分层
每页天空 / 地面或房间 / 可动元素 / 热区分开。Loading 与屋顶共用背景 WebP。

## 机型兼容
- 设计 440×956 @3x（1320×2868）
- 图片 `mode`：全屏背景 `aspectFill`；按钮 `widthFix` + `max-width` rpx
- `readSafeArea()` 处理刘海/底部横条
- 白名单外设备 → tollgate

## 安全
展示以服务端 ID 为准；价格、掉落、保底只信服务端。GM 独立云函数 + openid 白名单。
