# 资源对应列表（现有 PNG → 目标 WebP）

> 源文件均为 **@3x PNG**，转换规则见 [`ASSET-EXPORT.md`](./ASSET-EXPORT.md)：
> - `@3x`：原尺寸导出 WebP（质量 80–85，透明元素保留 Alpha）
> - `@2x`：宽高各 × 2/3 导出 WebP
> - 输出位置：`miniprogram/assets/{目标路径}@3x.webp`、`miniprogram/assets/{目标路径}@2x.webp`
>
> 本表覆盖 **62 个目标路径**；缺图见 [`ASSET-MISSING.md`](./ASSET-MISSING.md)（31 个）；
> 用不上的源文件见 [`ASSET-UNMAPPED.md`](./ASSET-UNMAPPED.md)（33 个）。
> 备注「共用」表示多个界面文件夹导出了同一张图，**只取一份转换**，任选其一即可（内容一致）。

---

## Loading 页

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `shared/roof/bg` | `loading/整页背景.png`（或 `屋顶/整页背景_1.png`） | 共用，Loading 与屋顶页同一背景 |
| `loading/btn-enter` | `loading/进入游戏按钮.png` | |
| `loading/btn-enter-disabled` | `loading/进入游戏按钮（禁用）.png` | |
| `loading/bar-track` | `loading/进度条轨道.png` | |
| `loading/bar-fill` | `loading/进度条填充.png` | |
| `loading/bar-thumb` | `loading/进度条滑块.png` | |

## 屋顶页

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `roof/star` | `屋顶/可收集星星（普通）.png` | |
| `roof/star-rice` | `屋顶/可收集星星（米字星）.png` | 与顶栏米字星共用；`主页/商店/屋顶/顶栏米字星 icon.png` 为重复文件 |
| `roof/magic-hat` | `屋顶/魔术帽.png` | |
| `roof/pigeon` | `屋顶/鸽子.png` | |
| `roof/pigeon-mail` | `屋顶/鸽子（叼信）.png` | |
| `roof/mail-tip` | `屋顶/信箱 NEW 标记.png` | |
| `roof/char-shen` | `屋顶/角色·深.png` | |
| `roof/char-biao` | `屋顶/角色·嫑.png` | 已确认：嫑＝标 |
| `roof/char-mi` | `屋顶/角色·米.png` | |
| `icons/roof/items` | `屋顶/顶栏物品.png` | |
| `icons/roof/home` | `屋顶/底栏回小屋.png` | |
| `icons/home/star` | `主页/顶栏星星 icon.png` | 共用；`商店/屋顶/扭蛋机/顶栏星星 icon.png` 为重复文件 |
| `icons/common/settings-grid` | `主页/顶栏设置.png` | 共用；`商店/屋顶/扭蛋机/顶栏设置.png` 为重复文件 |
| `home/btn-prepare` | `主页/底栏准备（宽按钮）.png` | 共用；`屋顶/底栏准备（宽按钮）.png` 为重复文件 |
| `icons/home/prepare` | `主页/底栏准备（icon 回退）.png` | 共用；`屋顶/底栏准备（icon 回退）.png` 为重复文件 |
| `icons/home/shop` | `主页/底栏商店.png` | 共用；`屋顶/底栏商店.png` 为重复文件 |
| `shared/trip-banner` | `主页/出行提示条.png` | 共用；`出行提示/出行提示条.png`、`屋顶/出行提示条.png` 为重复文件 |

## 主页

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `home/room` | `主页/整页背景（完整） .png` | 
| `icons/home/bag` | `主页/顶栏物品.png` | 

## 商店页

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `shop/page-bg` | `商店/整页背景.png` | |
| `icons/shop/back` | `商店/返回.png` | 共用；`展示柜/返回.png`、`扭蛋机/返回.png` 为重复文件 |
| `icons/shop/utility-gacha` | `主页/底部扭蛋.png`（或 `商店/底部侧键·扭蛋.png`） | 共用 |
| `shop/price-tag` | `商店/货架价签.png` | 
| `shop/btn-buy` | `商店/购买按钮.png` | 
| `shop/btn-buy-disabled` | `商店/购买按钮（灰）.png` | 
| `shop/side-btn-bag` | `商店/底部侧键·背包.png` | 

## 扭蛋页

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `gacha/machine` | `扭蛋机/扭蛋机.png` | |
| `gacha/btn-draw-1` | `扭蛋机/单抽.png` | |
| `gacha/btn-draw-5` | `扭蛋机/五连.png` | |
| `gacha/btn-prizes` | `扭蛋机/图鉴入口.png` | |
| `gacha/exchange-banner` | `扭蛋机/兑换横幅.png` | |
| `gacha/catalog-panel` | `扭蛋机/兑换列表背景.png` | |
| `gacha/result-panel` | `扭蛋机/结果弹窗背景.png` | |
| `gacha/btn-confirm` | `扭蛋机/结果确认按钮.png`（或 `展示柜/结果确认按钮.png`） | 同源 362×166，共用 |
| `icons/gacha/prize-locked` | `扭蛋机/未收集背景.png` | 

## 日记页 / 信件展开组件

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `diary/frame` | `日记本/整页背景_4.png` | 
| `diary/notebook` | `日记本/内页.png` | 笔记本底 |
| `diary/tab` | `日记本/分类（未选中）.png` | 
| `diary/tab-active` | `日记本/分类（选中）.png` | 
| `diary/letter-paper` | `日记本/信件展开.png` |
| `icons/diary/envelope` | `日记本/信封.png` | 
| `icons/diary/envelope-badge` | `日记本/信件提醒.png` | 

## 展示柜页

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `showcase/cabinet` | `展示柜/展示柜_1.png` | 木柜 |
| `showcase/detail-panel` | `展示柜/展示弹窗背景.png` | 详情弹窗面板 |

## 背包弹窗

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `bag/panel` | `背包/背包背景.png` | |
| `bag/btn-depart` | `背包/出发按钮.png` | |

## 告别弹窗

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `depart/panel` | `背包/确认出发背景.png` | |
| `depart/btn-wait` | `背包/再等等按钮.png` | |
| `depart/btn-confirm` | `背包/确认出发按钮.png` | |

## 鸽子信箱弹窗

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `mailbox/title` | `屋顶/信件名称框.png` | 

## 设置弹窗

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `settings/panel` | `设置/设置背景.png` | |
| `settings/toggle-on` | `设置/开关（开启）.png` | |
| `settings/toggle-off` | `设置/开关（关闭）.png` | |
| `settings/user-id-bar` | `设置/用户id背景.png` | |

## 物品列表弹窗

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `inventory/panel` | `物品/物品弹窗背景.png` | |

## 共用 icon

| 目标路径 | 源 PNG | 备注 |
|----------|--------|------|
| `icons/common/close` | `扭蛋机/结果弹窗关闭.png` | 通用关闭（棕圆白 X，116×107）；`展示柜/结果弹窗关闭.png` 与其字节完全一致，`背包/背包关闭.png` 为同一图标（115×107，裁切差 1px），均为重复文件，只导出一份 |

---

> ✅ **关闭按钮已定版**：背包、扭蛋结果、展示柜详情三个弹窗的关闭图为同一图标（棕圆白 X），统一取用 `扭蛋机/结果弹窗关闭.png` 导出 `icons/common/close`。`物品/物品弹窗关闭按钮.png`（104×104，橙 X + 白描边）是另一套样式，不导出，见 [`ASSET-UNMAPPED.md`](./ASSET-UNMAPPED.md)。

*统计：62 个目标路径可由现有 PNG 转换（取用 62 个源文件；另有 21 个跨文件夹重复/备选文件不重复导出）。*
*注：ASSET-NAMING.md 清单实际为 93 个路径（文中写 88 为计数笔误），93 = 62 已覆盖 + 31 缺图。*
