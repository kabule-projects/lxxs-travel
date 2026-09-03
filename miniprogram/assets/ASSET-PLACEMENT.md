# 资源落位状态

对照：`miniprogram/utils/asset-path.ts` ↔ `miniprogram/assets/`

检查命令：

```bash
node scripts/check-assets.js
node scripts/ensure-assets.js   # 缺 @2x/@3x/plain 时用现有档复制补齐
```

## 结论（2026-09-02）

| 项 | 状态 |
|----|------|
| 代码登记路径 | 97 个 |
| 磁盘均已有文件 | ✅ `MISSING = 0` |
| 每个路径含 `@2x` + `@3x` | ✅ `dpr_miss = 0` |
| 额外切图（未进代码表） | 78 个（`items/`、`tutorial/`、`common/star-value-bar*` 等） |

代码需要的文件**已经都在 `ASSET-NAMING.md` 规定路径上**；切图导入记录见 `ASSET-MAPPING.md`。

## 布局（非文件）

主页 / 屋顶曾被可视化编辑器写上错误内联 `style`（整体偏移、按钮被拉大），已去掉，改回 wxss 定位。图片内容仍可后续替换，不影响位置。

## 仍偏小的占位图（有路径，画面可能不对）

下列文件体积很小，多半是占位，有真图后直接**同名覆盖**即可：

- `roof/pigeon*`、`roof/pigeon-mail*`
- `roof/magic-hat*`
- `roof/mail-tip*`
- 部分 `settings/*` 若仍是占位

## 磁盘有、代码暂未用的资源（先留着）

例如：`common/star-value-bar*`、`items/**`、`postcards/**`、`tutorial/**`、`loading/title-*`、`gacha/result-title` 等。  
需要接进 UI 时再改 `asset-path.ts`，不要随意改文件名。
