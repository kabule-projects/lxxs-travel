# Loading 页 WebP 资源

**全项目图片统一 WebP**，见 `.cursor/rules/lxxs.mdc`。

## 命名与 DPR

按设计宽 **1320px（@3x）** 导出，并尽量同时提供 @2x（880px 宽）以兼容高端安卓。

| 文件名 | 说明 |
|--------|------|
| `bg@3x.webp` / `bg@2x.webp` / `bg.webp` | 整页背景（与屋顶同场景） |
| `btn-enter@3x.webp` | 「进入游戏」可点击态 |
| `btn-enter-disabled@3x.webp` | 加载中不可点态（可与可点击态相同，由代码降 opacity） |
| `bar-track@3x.webp` | 进度条轨道底图 |
| `bar-fill@3x.webp` | 进度条橙色填充条（会被横向裁剪） |
| `bar-thumb@3x.webp` | 进度指示器（白色小团子） |

代码会按 `utils/asset-path.ts` 自动选择 `@3x` 或 `@2x`，找不到时回退无后缀 `.webp`。

## 替换占位

当前若存在从 PNG 复制的占位文件，请用美术导出的 **真实 WebP** 覆盖。

## 导出建议

- 格式：WebP，质量 80–85
- 透明通道：按钮、指示器保留 Alpha
- 主背景可不含透明
