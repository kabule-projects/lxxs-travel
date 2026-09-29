# 新手教程：加入展示柜 / 日记（含备忘录） / 窗户步骤

## Context

当前教程在 `bag-depart`（小深出发）时直接 `guide.complete()` 并弹出新手奖励。用户希望在出发后继续引导：展示展示柜（showcase）、日记（diary，含备忘录自写文本功能介绍），最后引导点击窗户回到屋顶（roof），在 roof 完成教程并发放奖励。

## 新增 5 个步骤（插入 `bag-depart` 之后、`guide.complete()` 之前）

| # | 步骤 | 宿主 | 选择器 | 引导文字 |
|---|---|---|---|---|
| 1 | `home-showcase` | home | `.guide-anchor-showcase` | 小深出门了！带回来的纪念品会陈列在这里，点开看看吧。 |
| 2 | `home-diary` | home | `.guide-anchor-diary` | 旅行中的故事会记录在日记里，点开看看吧。 |
| 3 | `diary-memo` | diary | `.guide-anchor-memo` | 这里可以自己写旅行日记，点开看看吧。 |
| 4 | `diary-back` | diary | `.guide-anchor-diary-back` | 查看完毕，点击返回小屋。 |
| 5 | `home-window` | home | `.guide-anchor-window` | 点击窗户回到屋顶看看吧！ |

## 流程

1. **bag-depart**：出发成功 → `guide.advance('home-showcase')`（不调 complete）
2. **home-showcase**：遮罩指向展示柜热区 → 用户点击 → 进入 showcase → 用户自行点返回 → 回到 home
3. home `onShow` 检测 `isStep('home-showcase')` → advance 到 `home-diary`
4. **home-diary**：遮罩指向日记热区 → 用户点击 → 进入 diary
5. diary `onShow` 检测 `isStep('home-diary')` → advance 到 `diary-memo`（首次进入日记）
6. **diary-memo**：遮罩指向备忘录按钮 → 用户点击 → 进入 memo 页 → 用户自行点返回 → 回到 diary
7. diary `onShow` 检测 `isStep('diary-memo')` → advance 到 `diary-back`（从备忘录返回）
8. **diary-back**：遮罩指向日记返回按钮 → 用户点击 → 返回 home
9. home `onShow` 检测 `isStep('diary-back')` → advance 到 `home-window`
10. **home-window**：遮罩指向窗户 → 用户点击 → `navigateTo('/pages/roof/index')`
11. roof `onShow` 检测 `isStep('home-window')` → `guide.complete()` → 弹新手奖励

**推进原理**：引导遮罩只允许点击开孔内目标，`onShow` 再次触发说明用户已进入目标页并返回。

## 改动文件

### 1. `miniprogram/services/guide.ts`
- `GuideHost` 类型新增 `'diary'`
- `GUIDE_ORDER` 末尾在 `bag-depart` 后追加 5 个新步骤
- `GUIDE_META` 新增 5 条配置
- 新增 `buildGuideRewardItems(completed)` 共享函数：从 `GuideCompleteResult` 构建 `GachaResultItem[]` + 更新 wallet（从 home/index.ts 的 `showGuideReward` 提取）

### 2. `miniprogram/pages/home/index.ts`
- `onBagDepart`：`guide.complete()` + `showGuideReward` → `guide.advance('home-showcase')`
- `onShow`：新增——`isStep('home-showcase')` → advance 到 `home-diary`；`isStep('diary-back')` → advance 到 `home-window`
- `onTapShowcase`：`guide.isActive() && !guide.isStep('home-showcase')` 才拦截
- `onTapDiary`：`guide.isActive() && !guide.isStep('home-diary')` 才拦截
- `onTapWindow`：`guide.isActive() && !guide.isStep('home-window')` 才拦截
- `showGuideReward`：改调用 `guide.buildGuideRewardItems()`

### 3. `miniprogram/pages/home/index.wxml`
- `.hotspot-showcase` 加 `guide-anchor-showcase` class
- `.hotspot-diary` 加 `guide-anchor-diary` class
- `.home-window` 加 `guide-anchor-window` class

### 4. `miniprogram/pages/roof/index.ts`
- `data` 新增 `showGuideReward: false`、`guideRewardResults: [] as GachaResultItem[]`
- `onShow`：新增——`isStep('home-window')` → 调 `guide.complete()` → `guide.buildGuideRewardItems()` → `setData({ showGuideReward: true, guideRewardResults })`
- 新增 `onCloseGuideReward` 方法

### 5. `miniprogram/pages/roof/index.json`
- `usingComponents` 新增 `"gacha-result": "/components/gacha-result/gacha-result"`

### 6. `miniprogram/pages/roof/index.wxml`
- 底部新增 `<gacha-result>` 组件

### 7. `miniprogram/pages/diary/index.json`
- `usingComponents` 新增 `"guide-overlay": "/components/guide-overlay/guide-overlay"`

### 8. `miniprogram/pages/diary/index.ts`
- import guide + guide-page 工具
- `data` 新增 `guideVisible`、`guideHoles`、`guideHit`、`guideText`
- 实例字段新增 `_guideStep`、`_guideTimer`、`_guideBlockedAt`、`_offGuide`
- `onLoad`：订阅 `guide.onChange` → `refreshGuide()`
- `onUnload`：退订
- `onShow`：调 `refreshGuide()`；新增推进逻辑——`isStep('home-diary')` → advance 到 `diary-memo`；`isStep('diary-memo')` → advance 到 `diary-back`
- `onTapMemo`：`guide.isActive() && !guide.isStep('diary-memo')` 才拦截
- `onTapBack`：`guide.isActive() && !guide.isStep('diary-back')` 才拦截
- 新增 `refreshGuide`、`onGuideBlocked` 方法（同 home 模式）

### 9. `miniprogram/pages/diary/index.wxml`
- `.memo-btn` image 加 `guide-anchor-memo` class
- `.diary-back` image 加 `guide-anchor-diary-back` class
- 底部新增 `<guide-overlay>` 组件

## 不改动的文件
- showcase 页：不加遮罩，用户自行查看后返回
- memo 页：不加遮罩，用户自行查看后返回
- guide-page.ts：`refreshGuideHost` 已通用
- 云函数：不改

## 验证方式
1. 新用户走完整教程到 bag-depart
2. 出发后：遮罩指向 showcase 热区 → 点击进入 → 返回 → 遮罩指向 diary 热区
3. 点击 diary → 进入日记 → 遮罩指向备忘录按钮 → 点击进入 memo → 返回 diary → 遮罩指向返回按钮
4. 点击返回 → 回到 home → 遮罩指向窗户 → 点击 → 到达 roof → 新手奖励弹窗 → 确认 → 教程结束
5. 杀掉重进 → 教程不再激活
