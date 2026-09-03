# UI 全页审计与修复（2026-09-02）

## 根因

1. **可视化编辑器**在主页/屋顶写入错误内联 `style`（整体偏移、按钮被拉大）— 已清除  
2. **顶栏布局被改坏**：左侧占位宽度丢失，货币条靠左 — 已恢复居中  
3. **切图尺寸与用法不匹配**（`ASSET-MAPPING.md` 部分映射把整页图塞进小元素）  
4. **`nav-icon` / `star-counter` 用 `widthFix`**，大图会撑破固定槽位 — 已改 `aspectFit`

## 各页修复

| 页面 | 问题 | 处理 |
|------|------|------|
| 主页 | 内联偏移；顶栏不居中；准备钮过小 | 清内联；恢复 168rpx 侧栏；准备 280rpx |
| 屋顶 | 同上；设置/商店被拉大 | 清内联；顶栏居中 |
| 商店 | 顶栏对齐不稳；购买钮写死高度 | space-between；购买 `widthFix` 自适应 |
| 扭蛋 | `rug` 实为整页背景（含地毯） | 已正名为 `gacha/page-bg`；`machine` 限高 + aspectFit |
| 展示柜 | `cabinet` 为整页图却当柜体裁切 | `cabinet`→整页背景；槽位热区保留 |
| 日记 | frame/notebook 整页图用 scaleToFill 变形 | 改 aspectFill；Tab 改 aspectFit |
| 信箱 | panel 为扁长条却拉满高度 | 奶油底 + panel `widthFix` |
| 设置 | panel 占位图 300×200 | 面板自带奶油底，图降透明度 |
| 告别 | `depart/btn-confirm` 曾错映「回家提示」 | 弹窗用文字按钮；回家图已正名 `shared/trip-banner-return` |
| 全站 icon | widthFix 撑破 | `nav-icon` / `star-counter` / `star-item` → aspectFit |

## 仍需美术重导的错位资源

| 当前路径 | 实测尺寸 | 说明 |
|----------|----------|------|
| `gacha/machine` | 2000×4330 | 疑似整页，应用裁切后的扭蛋机单体 |
| `gacha/page-bg`（原 rug） | 1243×2690 | 整页背景（含地毯） |
| `showcase/cabinet` | 1243×2688 | 实为展示柜整页背景（代码已当背景用） |
| `showcase/shelf-board` | 1243×2690 | 同样是整页，暂未叠用 |
| `depart/btn-confirm` | 1243×177 | 曾错映「回家提示」；真出发按钮待美术；回家图见 `shared/trip-banner-return` |
| `settings/panel` 等 | 300×200 | 仍是占位 |
| `roof/pigeon*` 等 | 体积很小 | 占位，待真图同名覆盖 |

## 建议验收顺序

1. 主页：顶栏双货币居中，右上背包/设置，左下准备，右下商店/扭蛋  
2. 屋顶：同上 + 星星可点 + 鸽子区域  
3. 商店：返回/货币/扭蛋/设置；货架不溢出  
4. 扭蛋：背景铺满，扭蛋机不撑出屏外  
5. 日记 / 展示柜：整页背景正常，热区可点  
6. 设置 / 背包 / 信箱弹窗：居中、不变形  

检查脚本：`node scripts/check-assets.js`
