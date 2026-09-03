# 旅行小深 · 页面 UI Review 手册

> 供美术 / 产品 / 开发 review 用。记录每个页面的**静态图**、**可点击元素**、**弹窗组件**、**位置**与**交互**。
>
> 坐标说明：
> - **百分比**（`left/top/right/bottom: N%`）相对整屏，随背景 `aspectFill` 缩放
> - **rpx** 相对屏幕宽度 750rpx，适配不同机型
> - **safe-area**：顶栏 `padding-top: safeTop`，底栏 `padding-bottom: safeBottom`
> - 图片资源路径见 [`ASSET-NAMING.md`](./ASSET-NAMING.md)，均需 `@2x` / `@3x` WebP

---

## 全局约定

| 项目 | 说明 |
|------|------|
| 顶栏双货币 | 星星 + 米字星，居中两枚 `currency-pill`（高 52rpx，圆角胶囊） |
| 设置入口 | 各页右上角 `nav-icon` + `icons/common/settings-grid`，打开 `settings-modal` |
| `nav-icon` 尺寸 | `sm` 72rpx / `md` 96rpx / `lg` 120rpx |
| 进入游戏默认页 | Loading 完成后 → **屋顶** `pages/roof/index` |
| 出行提示条 | `trip-banner` 正中显示整图（出门/回家各一张，文案在图上）5 秒 |

### 页面导航关系

```
Loading ──自动──▶ 屋顶
                    ├─ 小屋（返回主页）
                    ├─ 商店 ──▶ 扭蛋
                    └─ 准备 ──▶ 背包弹窗 ──▶ 出发

主页
 ├─ 展示柜 / 衣柜 / 日记（家具热区）
 ├─ 商店 / 扭蛋（右下）
 └─ 背包 / 准备（左下）
```

---

## 1. Loading 页 `pages/loading`

**场景**：与屋顶共用夜空背景，底部进度条，中部进入按钮。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 全屏背景 | `shared/roof/bg` | `absolute` 铺满 | `aspectFill`，z-index 0 |
| 进入按钮（可用） | `loading/btn-enter` | 水平居中，`top: 38%` | 宽 560rpx，`widthFix` |
| 进入按钮（禁用） | `loading/btn-enter-disabled` | 同上 | 加载中半透明 |
| 进度条轨道 | `loading/bar-track` | 底部 `loading-frame` 内 | 组件 `loading-bar` |
| 进度条填充 | `loading/bar-fill` | 随 progress 裁剪宽度 | — |
| 进度条米子图标 | `loading/bar-thumb` | 贴在已填充进度末端，`left: progress%` 跟随 | — |

### 可点击 / 交互

| 元素 | 位置 | 交互 |
|------|------|------|
| 进入按钮热区 `.enter-hit` | 屏幕 38% 高度居中 | 加载完成后自动跳转屋顶；也可手动点击 |
| 加载提示文字 | 进度条上方 | 只读，显示「加载资源…」「同步数据…」等 |

### 组件

| 组件 | 触发 | 说明 |
|------|------|------|
| `loading-frame` | 始终显示 | 包裹底部进度条 + tip |
| `loading-bar` | 内嵌 | 显示 0–100% 进度 |

### 流程

1. 静默 `ensureSession()` 登录 / 建号（无弹窗）
2. 资源 + 场景加载完毕 → 进度 100% → 自动 `reLaunch` 到屋顶

---

## 2. 屋顶页 `pages/roof`（默认首页）

**场景**：夜空屋顶全景；星星动态；鸽子信箱；底栏导航。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 全屏背景 | `shared/roof/bg` | 铺满 | 与 Loading 共用 |
| 魔术帽 | `roof/magic-hat` | 鸽子区域内底部 | 108×76rpx，`aspectFit` |
| 鸽子（普通） | `roof/pigeon` | 鸽子区域内 | 96×96rpx |
| 鸽子（叼信） | `roof/pigeon-mail` | 有未读信时替换 | 带橙色光晕 |
| 邮件提示气泡 NEW | `roof/mail-tip` | 鸽子头顶上方 | 未读 1–4 封 |
| 邮件提示气泡「满」 | `roof/mail-tip-full` | 同上 | 未读达 `PIGEON_MAIL_CAP`（5）时替换 NEW |
| 角色·深深 | `roof/char-shen` | 底部居中偏左 | 宽 200rpx，`bottom: 220rpx` |
| 角色·标 | `roof/char-biao` | 深深右侧 | 宽 110rpx |
| 角色·米 | `roof/char-mi` | 深深左侧 | 宽 90rpx |
| 准备按钮图 | `home/btn-prepare` | 左下角 | 宽 280rpx；无图时用 icon 兜底 |

### 动态图片（星星）

| 元素 | 资源路径 | 位置算法 | 交互 |
|------|----------|----------|------|
| 普通星星 | `roof/star` | 见下表 | 落下后可点击收取 |
| 米字星 | `roof/star-rice` | 见下表 | 收取后加收藏品计数 |

**星星位置（百分比相对整屏）：**

| 状态 | 区域 | 坐标范围 |
|------|------|----------|
| 空中 pending | 屏幕中间夜空 | X: 29–69%，Y: 20–52%；显示倒计时 `remainText` |
| 落下 dropped | 鸽子左下堆叠区 | X: 54–66%，Y: 50–58%；随机旋转 ±20° |

组件 `star-item`：pending 宽 120rpx + 光晕；dropped 宽 72rpx。

### 顶栏 HUD（z-index 20）

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 左占位 | — | 宽 168rpx | 隐藏，用于居中平衡 |
| 星星数量 | `icons/home/star` + 数字 | 居中左 pill | 只读 |
| 米字星数量 | `roof/star-rice` + 数字 | 居中右 pill | 只读 |
| 物品 | `icons/roof/items` | 右上，`nav-icon sm` | 打开 `inventory-picker` |
| 设置 | `icons/common/settings-grid` | 右上 | 打开 `settings-modal` |

### 底栏（z-index 20，`bottom: 40rpx`）

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 准备 | `home/btn-prepare` 或 `icons/home/prepare` | **左下** | 旅行中 toast；否则打开 `bag-modal` |
| 商店 | `icons/home/shop` | **右下** 上 | `navigateTo` 商店 |
| 小屋 | `icons/roof/home` | **右下** 下 | `navigateBack` 主页 |

### 鸽子热区 `.pigeon-spot`

| 属性 | 值 |
|------|-----|
| 位置 | `right: 10%`，`bottom: 34%` |
| 尺寸 | 160×180rpx |
| 交互 | 点击打开 `mail-box-modal`；出行后鸽子飞走（`translate(120rpx,-220rpx) scale(0.4)`） |
| 收取星星 +1 | 普通星收取时显示 `+1` 文字动画（鸽子左下） |

### 弹窗 / 组件

| 组件 | 触发 | 说明 |
|------|------|------|
| `bag-modal` | 准备 | 选食物/米字星/道具 → 出发 |
| `inventory-picker` | 物品 | 只读查看背包（选中 toast） |
| `mail-box-modal` | 鸽子 | 未读明信片列表 → 放大 → 看信 → 收下 |
| `settings-modal` | 设置 | 音乐/音效开关 + 用户 ID |
| `trip-banner` | 出发/归来 | 屏幕正中横幅 5 秒 |

### 屋顶出发特殊流程

1. 背包点「出发」→ 鸽子飞走动画 0.9s
2. 显示「小深出门旅行了」横幅
3. 自动跳转 **主页**（空帽子状态）

---

## 3. 主页 `pages/home`（小屋）

**场景**：室内静态全景；家具为热区；无动态角色（V1 背景合一）。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 全屏背景 | `home/room` | 铺满 `aspectFill` | 含家具/装饰/角色合一 |
| 准备按钮 | `home/btn-prepare` | 左下角 | 同屋顶 |

### 顶栏 HUD

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 星星 / 米字星 | 同屋顶 | 居中双 pill | 只读 |
| 背包 | `icons/home/bag` | 右上 | 打开 `bag-modal` |
| 设置 | `icons/common/settings-grid` | 右上 | 打开 `settings-modal` |

### 家具热区（透明点击区，叠在背景上）

| 热区 | 位置（%） | 交互 |
|------|-----------|------|
| 展示柜 `.hotspot-showcase` | left 2%, top 14%, 22%×38% | → 展示柜页 |
| 衣柜 `.hotspot-wardrobe` | right 2%, top 22%, 26%×34% | **已禁用**（Phase2） |
| 日记 `.hotspot-diary` | left 30%, top 52%, 22%×18% | → 日记页 |

### 底栏

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 准备 | `home/btn-prepare` | **左下** | 同屋顶，打开背包 |
| 商店 | `icons/home/shop` | **右下** 上 | → 商店 |
| 扭蛋 | `icons/shop/utility-gacha` | **右下** 下 | → 扭蛋 |

### 弹窗 / 组件

| 组件 | 触发 | 说明 |
|------|------|------|
| `bag-modal` | 背包/准备 | 小屋出发：无鸽子动画，直接横幅 + 角色隐藏 |
| `settings-modal` | 设置 | 同上 |
| `trip-banner` | 出发/归来 | 同屋顶 |

---

## 4. 商店页 `pages/shop`

**场景**：整页静态背景 + 动态货架区 + 底部信纸简介区。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 全屏背景 | `shop/page-bg` | 铺满 | 含条纹墙/店主/柜台/木纹 |
| 价签底图 | `shop/price-tag` | 每个商品格下方 | 显示价格 + 星星 icon |
| 购买按钮（可用） | `shop/btn-buy` | 底部右侧 | 宽 200rpx |
| 购买按钮（禁用） | `shop/btn-buy-disabled` | 同上 | 未选中/已购/星星不足 |
| 侧栏·背包 | `shop/side-btn-bag` | 底部区右上 6% | 72×72rpx（toast 提示去主页背包） |
| 侧栏·扭蛋 | `shop/side-btn-gacha` | 底部区右上 38% | 72×72rpx → 扭蛋页 |

### 顶栏 HUD

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 返回 | `icons/shop/back` | 左上 `nav-icon sm` | → 主页 |
| 星星 / 米字星 | 居中双 pill | 只读 |
| 设置 | `icons/common/settings-grid` | 右上 | → settings-modal |
| 侧键·背包 / 扭蛋 | `shop/side-btn-bag` / `shop/side-btn-gacha` | 底部简介区右侧 | 扭蛋仅此入口 |

### Tab 栏

| 元素 | 位置 | 交互 |
|------|------|------|
| 分类 Tab（食物/道具等） | 顶栏下，横向滚动 | 切换商品列表 |
| 选中态 `.tab--on` | 深棕底白字 | — |

### 货架区 `.cabinet-layer`

| 属性 | 值 |
|------|-----|
| 位置 | `left/right: 9%`，`top: 36%`，`height: 30%` |
| 布局 | 每页 2 层货架 × 每层 3 格 = 6 格；左右滑 `swiper` 翻页 |
| 商品 icon | 动态（物品配置），112×112rpx |
| 价签 | 价格数字 + `icons/home/star` |
| 选中 | 格子上移 + 放大；已购当日半透明 |
| 页码 | 底部 `1 / N` 文字 |

### 底部简介区 `.footer-layer`

| 属性 | 值 |
|------|-----|
| 位置 | `left/right: 5%`，`bottom: 5%`，`height: 26%` |
| 左侧 | 商品名称 + 简介（最多 3 行） |
| 右侧 | 购买按钮 + 两个侧栏小按钮 |

### 交互汇总

| 操作 | 结果 |
|------|------|
| 点商品格 | 选中，更新底部简介 |
| 点购买 | 扣星星，当日限购标记 |
| 左右滑货架 | 翻页 |
| 点 Tab | 切换分类 |

---

## 5. 扭蛋页 `pages/gacha`

**场景**：地毯整页背景 + 居中扭蛋机 + 底部兑换条。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 全屏背景 | `gacha/page-bg` | 铺满 | 含地毯等，勿再叠地毯层 |
| 扭蛋机 | `gacha/machine` | 屏幕中部 | 宽 72%，max-height 52vh |
| 单抽按钮 | `gacha/btn-draw-1` | 机器下方控制区 | 高 64rpx |
| 五连按钮 | `gacha/btn-draw-5` | 同上 | 选中 opacity 1，未选 0.65 |
| 抽奖按钮 | `gacha/btn-spin` | 控制区右侧 | 宽 200rpx |
| 兑换横幅 | `gacha/exchange-banner` | 底部 | 宽 100%，max 620rpx |
| 奖品一览按钮 | `gacha/btn-prizes` | 横幅下方 | 宽 240rpx |

### 顶栏 HUD

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 返回 | `icons/shop/back` | 左上 | → 商店 |
| 星星计数 | `star-counter` 组件 | 顶部正中 | 只读 |
| 设置 | `icons/common/settings-grid` | 右上 | settings-modal |

### 交互

| 操作 | 结果 |
|------|------|
| 点单抽/五连 | 切换 `drawCount`（1 或 5） |
| 点抽奖 | 扣星星，机器抖动动画；可点遮罩跳过 |
| 点奖品一览 | 打开 `gacha-prizes` 图鉴弹窗 |
| 抽奖结束 | `gacha-result` 显示获得物品 |

### 弹窗

| 组件 | 资源 | 说明 |
|------|------|------|
| `gacha-result` | `gacha/result-panel`、`gacha/result-item-bg` + icon、`gacha/btn-confirm` | 每格底图叠实物；单抽 1 / 五连 3+2；重复转星 |
| `gacha-prizes` | `gacha/catalog-panel`、`result-item-bg` + icon、`icons/gacha/prize-locked` | 已收集：底+物；未收集：锁 |
| `settings-modal` | — | 同上 |

---

## 6. 展示柜页 `pages/showcase`

**场景**：木柜整页背景 + 动态物品格。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 全屏背景 | `showcase/cabinet`（含层板） | 铺满 | 木柜外框+层板合一 |
| 物品 icon | 动态 | 4 层 × 每层 2 格 | 120×120rpx |

### 顶栏

| 元素 | 资源 | 交互 |
|------|------|------|
| 返回 | `icons/shop/back` | → 主页（navigateBack） |
| 设置 | `icons/common/settings-grid` | settings-modal |

### 货架区

| 属性 | 值 |
|------|-----|
| 内框 | max-width 640rpx，高 860rpx，居中 |
| 4 层 shelf | 每层 2 个 slot（140×140rpx） |
| 翻页 | 左右滑 `swiper`，底部 `1 / N` |
| 点物品 | 打开 `showcase-detail` 弹窗 |

### 弹窗 `showcase-detail`

| 元素 | 资源 | 说明 |
|------|------|------|
| 面板底 | `showcase/detail-panel` | 弹窗外壳 |
| 纪念品方块底 | `showcase/detail-item-bg` | 小方块底层 |
| 纪念品图 | 云库 icon | 叠在底图之上 |
| 关闭 | `icons/common/close` | 右上 |

---

## 7. 日记页 `pages/diary`

**场景**：紫色外框 + 笔记本内页 + 明信片网格。

### 静态图片

| 元素 | 资源路径 | 位置 | 说明 |
|------|----------|------|------|
| 外框背景 | `diary/frame` | 铺满 | `aspectFill` |
| 笔记本底 | `diary/notebook`（含书脊/天气/吉祥物） | 内页区域 | `aspectFill` |
| Tab（激活） | `diary/tab-active` | 顶部 4 个 Tab 位 | 仅第 1 个激活（V1 无切换） |
| Tab（普通） | `diary/tab` | 后 3 个 | 装饰 |
| 格子半透明底 | CSS / 待重导 `diary/grid-cell` | 每格底层 | 设计稿浅紫半透明；现 `grid-cell` 过深暂用 CSS |
| 明信片缩略图 | 动态 URL | 叠在底格上 | 外围 `1px` / 50% 紫边；点格放大 |
| 信封 icon | `icons/diary/envelope`（含角标） | 放大卡右下 | — |

### 顶栏

| 元素 | 资源 | 交互 |
|------|------|------|
| 返回 | `icons/shop/back` | → 主页 |
| 设置 | `icons/common/settings-grid` | settings-modal |

### 网格区

| 属性 | 值 |
|------|-----|
| 布局 | 3 列，`gap: 20rpx`，正方形格；不足补齐至少 15 格空位 |
| 底格 | `rgba(186,178,224,0.45)` + `1px` / 50% 紫边 |
| 切图边框 | `1px solid rgba(90, 64, 136, 0.5)` |
| 滚动 | `scroll-view` 纵向 |

### 交互流程

1. 点网格格 → 全屏遮罩放大明信片（75vw，3:4）
2. 点遮罩空白 → 关闭
3. 点右下角信封 → `diary-letter` 看信（信纸合一背景）
4. 信件内可滚动阅读

### 弹窗 `diary-letter`

| 元素 | 资源 | 说明 |
|------|------|------|
| 信纸 | `diary/letter-paper`（含 DATE/天气/logo） | 正文叠在信纸上 |
| 日期文字 | 动态 `dateText` | 叠在信纸日期位 |
| 收下按钮 | **无** | 信箱展开信件时自动 `claim` |

---

## 8. 衣柜页 `pages/wardrobe`

**V1 空态页**，无背景整图。

### 静态图片

| 元素 | 资源路径 | 位置 |
|------|----------|------|
| 空态插画 | `wardrobe/empty` | 居中，宽 480rpx，`margin-top: 120rpx` |

### 顶栏

| 元素 | 资源 | 交互 |
|------|------|------|
| 返回 | `icons/shop/back` | → 主页 |
| 设置 | `icons/common/settings-grid` | settings-modal |

### 文字

- 居中：「衣柜还是空的」（或动态 `message`）

---

## 9. Tollgate 页 `pages/tollgate`

**不支持机型拦截页**，纯文字，无图片资源。

| 元素 | 位置 | 说明 |
|------|------|------|
| 标题 | 卡片居中 | 「当前设备暂不支持」 |
| 描述 | 下方 | 需常用 iPhone 或高端安卓 |
| 机型信息 | 底部 | 显示 model / width / DPR |

---

## 10. 共享弹窗 / 组件详解

### `settings-modal` 设置

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 遮罩 | 半透明黑 72% | 全屏 fixed z-120 | 点击关闭 |
| 面板 | `settings/panel`（含标题） | 居中 600rpx 宽 | — |
| 音乐开关 | `settings/toggle-on/off` | 右对齐 140rpx 宽 | 切换音乐 |
| 音效开关 | 同上 | — | 切换音效 |
| 通知 | — | **已隐藏** `wx:if="{{false}}"` | V2 预留 |
| 用户 ID 条 | `settings/user-id-bar` | 面板中下 | 只读显示 UUID |
| 版本号 | 文字 | 底部 | `APP_VERSION` |

### `bag-modal` 出行背包

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 面板 | `bag/panel`（含槽框+标签） | 居中宽 620rpx，`widthFix` | — |
| 关闭 / 清除 | `icons/common/close`（同一 icon） | 面板右上 / 槽内右上 | 关闭弹窗 / 清空该槽 |
| 美食热区 | 透明，无单独切图 | 左上约 148×148rpx | 点选 → inventory-picker |
| 米字星热区 | 透明 | 右上 | 点选携带 |
| 道具热区 ×2 | 透明 | 下方左右 | 点选道具 |
| 出发按钮 | `bag/btn-depart`（含 GO 气泡） | 面板下方 420rpx 宽 | 确认出行 → depart 流程 |

### `depart-modal` 出发确认（当前未挂到页面 WXML，逻辑保留）

| 元素 | 说明 |
|------|------|
| 面板 | `depart/panel` |
| 按钮 | 暂用**文字按钮**「再等等」「出发」（图片资源待修正） |

### `mail-box-modal` 鸽子信箱

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 面板 | `mailbox/panel`（含角饰） | 居中，`widthFix` | — |
| 标题 | `mailbox/title` | 顶部 | — |
| 关闭 | `mailbox/icon-close` | 右上 | 关闭 |
| 列表缩略图 | 数据库 `imageThumb` | 行左侧 | 明信片切图 |
| 信封 | `icons/diary/envelope`（含角标） | 放大卡右下 | 展开信件（自动收下） |
| 信件列表 | 缩略图 + 标题 | 可滚动 | 点行 → 放大 |
| 放大卡 | 同日记 zoom | 全屏遮罩 | 点信封看信 |
| 收下 | `diary/letter-btn-claim` | 信件底部 | 收下进日记 |

### `inventory-picker` 背包选择器

| 元素 | 资源 | 位置 | 交互 |
|------|------|------|------|
| 面板 | `inventory/panel` | 居中弹窗 | — |
| 美食 Tab | `inventory/tab-food` / `tab-food-on` | 顶部 | 未选矮 / 选中增高；切 `food` |
| 道具 Tab | `inventory/tab-prop` / `tab-prop-on` | 顶部 | 未选矮 / 选中增高；切 `prop` |
| 行背景框 | `inventory/item-row` | 每件物品一行 | 几件几框 |
| 物品图 + 文字 | 动态 icon / name / desc | 叠在行框上 | **点选即返回**，无 checkbox |
| 背包槽位图 | 动态 icon | 叠在 `bag/panel` 上 | 选中后回填槽位 |

### `nav-icon` 导航图标

| 尺寸 | 点击区 | 属性 |
|------|--------|------|
| sm | 72×72rpx | `aspectFit`，hover 缩小 |
| md | 96×96rpx | — |
| lg | 120×120rpx | — |

### `star-counter` 星星计数（扭蛋页）

- 居中显示星星 icon + 数量
- 资源：`icons/home/star`

### `trip-banner` 出行/回家提示

| 元素 | 资源 | 位置 |
|------|------|------|
| 出门提示整图 | `shared/trip-banner` | 屏幕垂直正中，宽 100%，文案在图上 |
| 回家提示整图 | `shared/trip-banner-return` | 同上 |

- 出发：显示出门图 5 秒后消失
- 归来：显示回家图 5 秒后 `claimHome`
- **不再叠字**

### `loading-bar` / `loading-frame`

- 固定在屏幕底部，含轨道 / 填充 / **米子图标**三张 WebP
- 米子贴在已填充进度末端（`left: progress%`），随进度跟随
- 上方显示加载 tip 文字

---

## 11. Z-index 层级参考

| 层级 | 元素 |
|------|------|
| 0 | 各页全屏背景 |
| 3–6 | 屋顶星星、鸽子、角色装饰 |
| 12 | 主页家具热区 |
| 20 | 各页顶栏 / 底栏 HUD |
| 25 | trip-banner |
| 50–51 | 扭蛋抽奖遮罩 |
| 60 | bag-modal |
| 100 | 日记/信箱放大遮罩 |
| 120 | settings-modal |

---

## 12. Review 检查清单

- [ ] **Loading / 屋顶** 是否共用同一张 `shared/roof/bg`，边缘无裁切问题
- [ ] **主页** `home/room` 上展示柜/衣柜/日记热区是否对齐家具
- [ ] **商店** 货架区 9%/36%/30% 是否对齐 `page-bg` 玻璃柜台
- [ ] **商店** 底部信纸区简介文字是否在信纸范围内
- [ ] **扭蛋** `page-bg` 是否铺满，地毯是否已含在背景内；`machine` 比例是否合适
- [ ] **展示柜** `cabinet` 背景与 4×2 格点击区是否对齐
- [ ] **屋顶星星** 空中区与落下堆叠区是否在鸽子左下、不遮挡角色
- [ ] **鸽子** 普通/叼信/飞走三态切换是否正确
- [ ] **所有 nav-icon** 是否为正方形 icon，无拉伸变形
- [ ] **所有弹窗** 关闭按钮是否在安全区内可点
- [ ] **双货币 pill** 在各页顶栏是否视觉居中

---

*文档生成：2026-09-02 · 对应代码分支当前实现*
