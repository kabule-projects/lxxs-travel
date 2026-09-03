# WebP 资源文件名总表（2026-09-03 修订版）

> **怎么作图、怎么导出 @2x/@3x** → [`ASSET-EXPORT.md`](./ASSET-EXPORT.md)  
> **登记源**：`miniprogram/utils/asset-path.ts`  
> **磁盘根**：`miniprogram/assets/`  
> 每个路径导出 **两个文件**：`{路径}@2x.webp`、`{路径}@3x.webp`

本表只列**代码正在使用**的 UI 切图。云库动态图（商品 / 明信片 / 展品 icon）不在此表。

---

## 通用约定

| 规则 | 说明 |
|------|------|
| 整页背景 | 能画进背景的装饰（地毯、层板、店主、书脊等）**不要再单独导出** |
| 叠层 | 「底图 + 实物」两层：底图在命名表；实物走云库 / 动态 path |
| 提示条 | 出门 / 回家是**整图**（文案画在图上），不叠字 |
| 关闭 | 优先复用 `icons/common/close` |

---

## Loading

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 整页背景 | `shared/roof/bg` | 与屋顶共用 |
| 进入游戏 | `loading/btn-enter` | |
| 进入游戏（禁用） | `loading/btn-enter-disabled` | |
| 进度轨道 | `loading/bar-track` | |
| 进度填充 | `loading/bar-fill` | |
| 进度米子 | `loading/bar-thumb` | 贴进度末端跟随 |

---

## 屋顶

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 整页背景 | `shared/roof/bg` | |
| 普通星 | `roof/star` | |
| 米字星 | `roof/star-rice` | 亦作顶栏米字星 icon |
| 魔术帽 | `roof/magic-hat` | |
| 鸽子 | `roof/pigeon` | |
| 鸽子（叼信） | `roof/pigeon-mail` | |
| NEW 提示 | `roof/mail-tip` | 未读 1–4 |
| 「满」提示 | `roof/mail-tip-full` | 未读 = 5 |
| 角色·深 / 标 / 米 | `roof/char-shen` `roof/char-biao` `roof/char-mi` | |
| 顶栏星星 | `icons/home/star` | |
| 顶栏物品 | `icons/roof/items` | → 物品列表 |
| 顶栏设置 | `icons/common/settings-grid` | |
| 准备按钮 | `home/btn-prepare` | 兜底 `icons/home/prepare` |
| 商店 | `icons/home/shop` | |
| 回小屋 | `icons/roof/home` | |
| 出门提示整图 | `shared/trip-banner` | 文案在图上 |
| 回家提示整图 | `shared/trip-banner-return` | 文案在图上 |

---

## 主页（小屋）

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 整页背景 | `home/room` | 家具 / 角色已画进背景 |
| 顶栏星星 / 米字星 | `icons/home/star` / `roof/star-rice` | |
| 顶栏背包 | `icons/home/bag` | → 背包弹窗 |
| 顶栏设置 | `icons/common/settings-grid` | |
| 准备 | `home/btn-prepare` | |
| 商店 | `icons/home/shop` | |
| 扭蛋 | `icons/shop/utility-gacha` | |
| 出门 / 回家提示 | `shared/trip-banner` / `shared/trip-banner-return` | |

展示柜 / 衣柜 / 日记：**透明热区**，无单独切图。

---

## 商店

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 整页背景 | `shop/page-bg` | 店主 / 柜台等已画进 |
| 返回 | `icons/shop/back` | |
| 顶栏星星 / 米字星 | `icons/home/star` / `roof/star-rice` | |
| 顶栏设置 | `icons/common/settings-grid` | **顶栏无扭蛋** |
| 价签 | `shop/price-tag` | |
| 购买 / 灰 | `shop/btn-buy` / `shop/btn-buy-disabled` | |
| 侧键·背包 | `shop/side-btn-bag` | |
| 侧键·扭蛋 | `shop/side-btn-gacha` | 扭蛋仅从此进 |

货架商品图：云库 `items.icon`。

---

## 扭蛋

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 整页背景（含地毯） | `gacha/page-bg` | **勿再出地毯** |
| 扭蛋机 | `gacha/machine` | |
| 单抽 / 五连 / 抽奖 | `gacha/btn-draw-1` `gacha/btn-draw-5` `gacha/btn-spin` | |
| 图鉴入口 | `gacha/btn-prizes` | |
| 兑换横幅 | `gacha/exchange-banner` | |
| 结果面板 | `gacha/result-panel` | |
| 结果格底图 | `gacha/result-item-bg` | + 实物 icon 叠放 |
| 结果确认 | `gacha/btn-confirm` | |
| 图鉴面板 | `gacha/catalog-panel` | |
| 图鉴锁 | `icons/gacha/prize-locked` | 未收集 |
| 关闭 | `icons/common/close` | |

图鉴已收集格：同用 `result-item-bg` + icon。

---

## 日记

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 外框 | `diary/frame` | |
| 笔记本底 | `diary/notebook` | 含书脊 / 天气 / 吉祥物 |
| Tab 未选 / 选中 | `diary/tab` / `diary/tab-active` | |
| 格子半透明底 | `diary/grid-cell` | 宜浅紫半透明；现图过深时用 CSS 底 |
| 信封 | `icons/diary/envelope` | 含角标 |
| 返回 / 设置 | `icons/shop/back` / `icons/common/settings-grid` | |

明信片切图外围：CSS `1px` / `rgba(90,64,136,0.5)`。  
缩略图 / 主图：库字段 `imageThumb` / `imageFull` → `postcards/{name}-thumb` / `postcards/{name}`。

### 信件展开

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 信纸 | `diary/letter-paper` | DATE / 天气 / logo 已画进；无收下按钮 |

---

## 展示柜

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 木柜（含层板） | `showcase/cabinet` | **勿再出 shelf-board** |
| 详情面板 | `showcase/detail-panel` | |
| 纪念品方块底 | `showcase/detail-item-bg` | + 展品 icon 叠放 |
| 返回 / 设置 / 关闭 | `icons/shop/back` / `icons/common/settings-grid` / `icons/common/close` | |

---

## 衣柜

| 界面元素 | 文件名 |
|----------|--------|
| 空态 | `wardrobe/empty` |
| 返回 / 设置 | `icons/shop/back` / `icons/common/settings-grid` |

---

## 背包弹窗

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 面板 | `bag/panel` | 槽位框 + 标签已画进 |
| 出发 | `bag/btn-depart` | 含 GO 气泡 |
| 关闭 / 清槽 | `icons/common/close` | |

选中后：**物品 icon 叠在面板槽位上**（不叠名称）。  
**勿再导出** `bag/slot-*` / `label-*` / `go-bubble`。

---

## 物品列表弹窗

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 面板 | `inventory/panel` | |
| 美食 Tab 未选 / 选中 | `inventory/tab-food` / `inventory/tab-food-on` | 选中更高 |
| 道具 Tab 未选 / 选中 | `inventory/tab-prop` / `inventory/tab-prop-on` | 选中更高 |
| 列表行背景框 | `inventory/item-row` | 几件几框；上叠 icon + 文字 |
| 关闭 | `icons/common/close` | |

- Tab ↔ type：美食=`food`，道具=`prop`  
- **无 checkbox**；点选即返回  
- 背包选物关闭后，icon 回填到 `bag/panel` 槽位

---

## 鸽子信箱

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 面板 | `mailbox/panel` | 角饰已画进 |
| 标题 | `mailbox/title` | |
| 关闭 | `mailbox/icon-close` | |
| 信封 | `icons/diary/envelope` | |
| 缩略占位 | `icons/common/thumb-placeholder` | |

列表图：`postcards.imageThumb`。**勿再出** `mailbox/deco` / `envelope-badge`。

---

## 告别弹窗

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 面板 | `depart/panel` | |
| 再等等 | `depart/btn-wait` | |
| 确认出发 | （待美术） | 勿用曾错映的回家提示图 |

当前确认钮可用文字按钮。

---

## 设置弹窗

| 界面元素 | 文件名 | 备注 |
|----------|--------|------|
| 面板 | `settings/panel` | 标题已画进 |
| 开关 ON / OFF | `settings/toggle-on` / `settings/toggle-off` | |
| 用户 ID 条 | `settings/user-id-bar` | |

**勿再出** `settings/title`。

---

## 登录授权（若启用）

| 界面元素 | 文件名 |
|----------|--------|
| 面板 | `profile/panel` |
| 头像占位 | `profile/avatar-placeholder` |
| 提交 | `profile/btn-submit` |

---

## 去重路径清单（代码在用）

共 **约 78** 个路径 × `@2x` + `@3x`。

```
bag/btn-depart
bag/panel
depart/btn-wait
depart/panel
diary/frame
diary/grid-cell
diary/letter-paper
diary/notebook
diary/tab
diary/tab-active
gacha/btn-confirm
gacha/btn-draw-1
gacha/btn-draw-5
gacha/btn-prizes
gacha/btn-spin
gacha/catalog-panel
gacha/exchange-banner
gacha/machine
gacha/page-bg
gacha/result-item-bg
gacha/result-panel
home/btn-prepare
home/room
icons/common/close
icons/common/settings-grid
icons/common/thumb-placeholder
icons/diary/envelope
icons/gacha/prize-locked
icons/home/bag
icons/home/prepare
icons/home/shop
icons/home/star
icons/roof/home
icons/roof/items
icons/shop/back
icons/shop/utility-gacha
inventory/item-row
inventory/panel
inventory/tab-food
inventory/tab-food-on
inventory/tab-prop
inventory/tab-prop-on
loading/bar-fill
loading/bar-thumb
loading/bar-track
loading/btn-enter
loading/btn-enter-disabled
mailbox/icon-close
mailbox/panel
mailbox/title
profile/avatar-placeholder
profile/btn-submit
profile/panel
roof/char-biao
roof/char-mi
roof/char-shen
roof/magic-hat
roof/mail-tip
roof/mail-tip-full
roof/pigeon
roof/pigeon-mail
roof/star
roof/star-rice
settings/panel
settings/toggle-off
settings/toggle-on
settings/user-id-bar
shared/roof/bg
shared/trip-banner
shared/trip-banner-return
shop/btn-buy
shop/btn-buy-disabled
shop/page-bg
shop/price-tag
shop/side-btn-bag
shop/side-btn-gacha
showcase/cabinet
showcase/detail-item-bg
showcase/detail-panel
wardrobe/empty
```

导出格式：`miniprogram/assets/{路径}@2x.webp` 与 `@3x.webp`。

---

## 已废弃 / 勿再导出

```
# 已并入背景或其它资源
gacha/rug                    → 用 gacha/page-bg
showcase/shelf-board         → 已画进 showcase/cabinet
bag/slot-* / label-* / go-bubble
diary/spine / mascot / weather-* / letter-* 零散件
mailbox/deco*
settings/title
shared/roof/sky / rooftop    → 用 shared/roof/bg

# 错映射 / 待替换
depart/btn-confirm           → 曾是「回家提示」，勿当出发按钮
inventory/checkbox*          → 已取消勾选交互

# V1 未接主流程
home/shenshen-bed|table|window|desk
loading/title-*
```

---

## 叠层速查

| 场景 | 底层 | 上层 |
|------|------|------|
| Loading 进度 | bar-track / bar-fill | bar-thumb（米子） |
| 出门 / 回家 | — | trip-banner / trip-banner-return（整图） |
| 展示柜详情 | detail-item-bg | 展品 icon |
| 扭蛋结果 / 图鉴已收集 | result-item-bg | 实物 icon |
| 日记格子 | grid-cell 或 CSS 浅紫底 | 明信片 thumb + 紫描边 |
| 物品列表行 | item-row | icon + 名称简介 |
| 背包槽位 | bag/panel | 物品 icon |
