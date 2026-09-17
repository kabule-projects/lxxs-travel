# 新手指引（强制式遮罩教学）- 产品需求文档

## Overview
- **Summary**: 新用户首次进入游戏后，由一套全屏半透明黑色遮罩 + 目标开孔的强制式引导，依次教会：屋顶拾取星星 → 商店买食物 → 扭蛋抽道具 → 回小屋打开背包携带食物与道具并出发旅行。
- **Purpose**: 让新用户在受控操作中走通核心循环（攒星 → 消费 → 备行李 → 出门），降低首次使用门槛。
- **Target Users**: 首次进入游戏且未完成指引的用户（含开发者工具中的新登录账号）。

## Goals
- 指引激活期间，除当前步骤目标区域外，页面其他任何按钮/热区均不可点击（黑色 70% 半透明遮罩盖住）。
- 目标区域以白色圆角开孔高亮 + 文字气泡说明 + CSS 脉冲圈提示可点。
- 流程必须真实走通经济系统：现成可拾取的 8 颗普通星星 和 1 颗 rice star → 花 3 星买shop的第一件食物（grid左上角，价格 3）→ 花 5 星单抽扭蛋 → 背包食物槽放便当、道具槽放抽到的道具 → 点 GO 真实出发。
- 未完成指引时，下次冷启动从头（屋顶步骤）开始；已产生的经济结果（星星/购买/抽奖/库存）不保留。
- 完成后永久不再出现（云端 users 字段为准，本地存储兜底）。

## Non-Goals
- 不做指引相关的美术贴图（气泡、开孔、手指全部 CSS/系统字体实现）。
- 不做老用户批量标记工具（线上既有无标记账号会看到一次指引；如需规避由运营脚本处理，见 Assumptions）。
- 不做指引的跳过按钮、重播入口、多语言（仅中文文案）。
- 不改变非指引状态下任何现有玩法逻辑与数值。
- 不做指引步骤进度的云端跨设备续接（未完成即重开，仅"完成与否"持久化）。

## Background & Context
- 入口链路：loading 页点进入 → `wx.reLaunch('/pages/roof/index')`（游戏落地页是屋顶，不是 home）。
- 页面栈：roof →（onTapShop）shop →（onTapGacha）gacha；gacha 返回键设计上回 shop。home 不在该栈中，故扭蛋后采用 reLaunch 回小屋。
- 星星体系：云端 `roof_stars` 集合（pending/dropped/collected），roof 云函数 `sync` 负责掉落推进与生成，`collect` 收款；客户端 services/roof.ts 有完整本地兜底（`lxxs_roof_local`）。
- 商店：云函数 `shop list` 按 `shopSort asc` 返回 `type:'food'` 物品；首件 = `potato`，price 3，每日限购 1。购买成功发 `INVENTORY_CHANGED` 并本地 bump 库存。
- 扭蛋：单抽成本 `GAME.GACHA_COST = 5`；结果弹窗组件 `gacha-result` 有关闭 X 与确认键两个出口。
- 背包：`bag-modal` 组件，食物槽 1 个 + 米子槽 1 个 + 道具槽 2 个；点槽位打开 `inventory-picker`（支持 lock-tab）；`onDepart` 触发页面 `startTrip(loadout)`，成功后 TRIP_STARTED 重置 loadout。
- 用户档案：登录云函数 `login` session 建号（无 guide 相关字段）；客户端 `store/user.ts` 持有 UserProfile；事件总线 `utils/event-bus.ts`。
- 页面禁滚动：各页根节点 `catchtouchmove="onStopMove"`，指引遮罩不得破坏该机制。

## Functional Requirements

- **FR-1 指引资格与生命周期**
  - 登录会话返回的 profile 含 `guideCompletedAt`（null/缺失 = 未完成）。
  - 未完成用户进入屋顶页（onShow 且会话就绪）时激活指引，步骤固定从 `roof-stars` 开始，每次冷启动重置到首步。
  - 完成（真实出发成功）后：云端置 `guideCompletedAt`，本地写 `lxxs_guide_completed`；此后任何页面不再出现指引 UI。
  - 离线/云调用失败：以本地标志位判定完成与否。

- **FR-2 屋顶 9 颗教学星星**
  - 云端 roof `sync`：用户 `guideSeededAt` 为空且 `guideCompletedAt` 为空时，一次性生成 9 颗 `status:'dropped'` 的普通（非米）星星（位置复用 randomPilePos，doc 带 `guide:true`），并置 `guideSeededAt`。sync 返回值增加 `guideDropped`（剩余带 guide 标记的 dropped 数量）。
  - 播种只发生一次，重复 sync/重试不会多发（flag 幂等）。
  - 本地兜底模式同步注入 9 颗 dropped（本地 flag 幂等）。
  - 教学星与普通星收款逻辑完全一致，每颗 +1 stars。

- **FR-3 强制遮罩交互**
  - 遮罩为 fixed 全屏、rgba(0,0,0,0.72)、z-index 高于现有所有弹窗（settings/邮件/结果弹窗等）。
  - 每个步骤声明视觉开孔（可多个，如屋顶 9 颗星各自开孔）与一个"交互放行矩形"（默认为开孔外接矩形；屋顶步骤为覆盖星星活动区的单个放行带）。
  - 放行矩形内触摸穿透到原有 UI；矩形外由四块遮挡条 catchtap 吞掉点击（可给轻微抖动/ toast "请先完成指引"提示）。
  - 目标元素位置在图片加载、setData、星星数量变化后重新测量，保证开孔不漂移。

- **FR-4 步骤序列（13 步）**
  1. `roof-stars`：开孔高亮全部 dropped 教学星，其余 UI 全锁；捡完（guideDropped=0，首跑即捡满 9 颗）后推进。
  2. `roof-to-shop`：仅放行屋顶底部商店按钮。
  3. `shop-select`：仅放行货架第一页第一格（food_bento_a）；点其他格子无效。
  4. `shop-buy`：仅放行购买按钮；购买成功（扣 3 星）推进。重启时若该物品 boughtToday 则自动跳过 3/4。
  5. `shop-to-gacha`：仅放行扭蛋侧按钮。
  6. `gacha-draw`：仅放行单抽按钮（五连按钮锁定）；余额不足（<5）属于异常，不做特殊处理（正常不会发生）。
  7. `gacha-result`：结果弹窗中关闭 X 隐藏/禁用，仅确认键可点；确认后关闭弹窗并 `wx.reLaunch('/pages/home/index')`，步骤切到 home-bag。
  8. `home-bag`：仅放行小屋背包侧按钮（side-btn-bag）。
  9. `bag-food`：背包弹窗内仅放行食物槽。
  10. `picker-food`：库存选择器锁定 food tab，仅第一件食物可点（即便当）。
  11. `bag-prop`：仅放行道具槽 0。
  12. `picker-prop`：选择器锁定 prop tab，仅第一件道具可点（扭蛋奖品）。
  13. `bag-depart`：仅放行 GO 出发按钮；startTrip 成功 → 指引完成（FR-1 持久化），遮罩消失。

- **FR-5 文字气泡**
  - 每步一句中文短文案（系统字体，白字深色圆角气泡，自动置于开孔上方/下方，不遮挡开孔）。
  - 文案内置于 guide 步骤配置，不接 CDN。

- **FR-6 防护与异常**
  - 遮罩之外，关键 handler 加指引状态防御（shop 选格、gacha 抽次、导航类按钮），双保险。
  - 指引激活期间禁止打开 settings/inventory-picker(非教学)/邮件等旁路弹窗（遮罩物理阻挡 + handler 防御）。
  - 任一云调用失败不卡死流程：收款/购买/抽奖沿用现有失败提示；指引步骤只在真实成功回调里推进。
  - 道具槽教学假定扭蛋奖品在库存中 category 为 prop（见 Assumptions）。

## Non-Functional Requirements
- **NFR-1 零新增美术资源**：不注册任何新 asset-path 贴图，不使用 emoji；视觉全部 WXSS 实现。
- **NFR-2 真机一致性**：使用 fixed + px 矩形（boundingClientRect 本就是视口坐标），不使用在真机有兼容问题的百分比高度链。
- **NFR-3 不影响老流程**：指引关闭/完成后，所有页面代码路径与现状一致；改动以"指引激活时才生效"的分支为主。
- **NFR-4 可维护性**：步骤定义（id、页面、目标选择器、文案、放行矩形策略）集中在 guide service 配置中，文案/选择器单点可改。
- **NFR-5 部署友好**：云函数改动遵循 common 同步机制（`node scripts/sync-cloud-common.js` 后再上传）。

## Constraints
- **Technical**: 微信原生小程序（无 Taro/第三方 UI 库）；云开发 wx-server-sdk；组件样式隔离下，bag-modal / inventory-picker / gacha-result 内部目标只能由组件自行测量并在组件内部渲染遮罩层。
- **Business**: 教学经济必须守恒：9 颗普通星 − 3 购买 − 5 单抽 = 余 1 星；不得给玩家额外可刷星的途径（播种严格一次性）。
- **Dependencies**:
  - `items` 集合中 food_bento_a 存在、enabled、price=3、shopSort 最小（当前 seed 已满足）。
  - `gacha_pool` 中单抽奖品入库后在 inventory 的 category 为 prop（数据侧需确认/保证）。
  - 云函数 login、roof 需重新部署；common/user.js 变更需同步到全部函数目录后部署。

## Assumptions
- 线上存量无 `guideCompletedAt` 的账号首次更新后会看到一次指引；如需避免，运营侧批量置位（不在本期交付范围）。
- 玩家在指引途中杀进程：星星/购买/抽奖结果已落库，重开后屋顶步骤在 guideDropped=0 时秒过、已购食物步骤秒过，引导继续向后走，不需要重置经济。
- 单抽奖品若因奖池配置出现 food 类（prop tab 为空），`picker-prop` 步骤无法完成；视为数据配置问题，验收时需确认 gacha_pool 奖品均为 prop 类。
- 出发步骤成功后小深进入真实旅行（倒计时与明信片逻辑保持原样），玩家已知悉并确认此设计。

## Acceptance Criteria

### AC-1: 未完成用户自动进入指引
- **Type**: `rule`
- **Given**: profile.guideCompletedAt 为空（或本地无完成标志）的账号
- **When**: 完成 loading 进入屋顶页 onShow
- **Then**: 指引激活于 `roof-stars` 步骤，全屏遮罩出现且仅星星可点
- **Pass Condition**: 新登录账号冷启动后必现遮罩；已有完成标志账号任何冷启动均不出现
- **Evidence**: DevTools+真机各执行一次新账号流程目视验证；store/profile 字段检查

### AC-2: 9 颗教学星一次性幂等播种
- **Type**: `rule`
- **Given**: 新用户首次 roof sync
- **When**: sync 返回
- **Then**: dropped 中恰有 9 颗 guide:true 普通星可立即拾取；再次/多次 sync 数量不增加
- **Pass Condition**: roof_stars 新增 9 条且 users.guideSeededAt 被置位；第二次 sync 不新增
- **Evidence**: 云数据库 roof_stars/users 文档查询；本地模式检查 lxxs_roof_local

### AC-3: 遮罩外不可交互、开孔内可正常点击
- **Type**: `rule`
- **Given**: 任一步骤遮罩显示
- **When**: 点击遮罩暗区各按钮（含设置、背包、返回、五连、其他格子等）
- **Then**: 均无反应；点击开孔内目标元素触发原有行为
- **Pass Condition**: 每个步骤至少抽测 2 个暗区热区被吞 + 目标热区生效
- **Evidence**: 13 步逐步手测记录（DevTools + 真机）

### AC-4: 屋顶步骤完成条件
- **Type**: `rule`
- **Given**: roof-stars 步骤
- **When**: 9 颗教学星尚未捡完时点击商店按钮
- **Then**: 被遮罩阻挡；捡完最后一颗后开孔切换到商店按钮
- **Pass Condition**: guideDropped=0 才推进；星星余额为 9
- **Evidence**: 拾取计数与 stars UI 数值

### AC-5: 商店强制购买指定食物
- **Type**: `rule`
- **Given**: shop-select / shop-buy 步骤
- **When**: 点非首格、未选物点购买、点其他入口
- **Then**: 全部无效；选 food_bento_a 后购买成功扣 3 星并自动进入扭蛋入口步骤
- **Pass Condition**: stars 9→6，库存 +1，boughtToday=true；重启场景下已购则该两步骤自动跳过
- **Evidence**: 购买回调结果 + 库存存储 + 步骤切换观察

### AC-6: 扭蛋强制单抽并自动回小屋
- **Type**: `rule`
- **Given**: gacha-draw 步骤
- **When**: 点五连/返回/奖品图鉴
- **Then**: 被阻挡；单抽成功（扣 5 星）后结果弹窗只有确认可点，确认即 reLaunch home
- **Pass Condition**: stars 6→1；reLaunch 后页面栈仅 home，指引处于 home-bag
- **Evidence**: 余额变化、getCurrentPages 栈检查、遮罩步骤

### AC-7: 背包装载与真实出发完成指引
- **Type**: `rule`
- **Given**: home-bag → bag-food → picker-food → bag-prop → picker-prop → bag-depart
- **When**: 按序操作，未轮到的槽位/GO 不可点
- **Then**: 食物=便当、道具0=抽到的道具；GO 后 startTrip 成功，指引标记完成并消失
- **Pass Condition**: users.guideCompletedAt 有值；本地 lxxs_guide_completed 有值；角色进入旅行态；重进不再出现遮罩
- **Evidence**: 云端 users 文档、本地存储、TRIP_STARTED 后 UI

### AC-8: 未完成冷启动从头开始且幂等不重复扣费
- **Type**: `rule`
- **Given**: 在任一中间步骤杀进程重开
- **When**: 重新进入游戏
- **Then**: 从 roof-stars 开始；已完成的经济结果保留；已满足的步骤自动放行；全程不产生第二次扣费/重复播种
- **Pass Condition**: 三种断点（屋顶捡完后、购买后、抽奖后）各测一次，最终都能走到完成且余额正确
- **Evidence**: 断点续跑手测记录与余额核对

### AC-9: 指引视觉质量
- **Type**: `rubric`
- **Dimension**: 高亮开孔与气泡的对齐、可读性、动制品质感
- **Scale**: 1-5
- **Anchors**: 1 = 开孔漂移/遮挡目标，文字看不清；3 = 位置基本准但偶有抖动或气泡压线；5 = 开孔贴合、气泡不挡目标、脉冲自然、多机型一致
- **Pass Threshold**: >= 4
- **Evidence**: iPhone 真机 + DevTools 不同机型截图

### AC-10: 流程健壮性
- **Type**: `rubric`
- **Dimension**: 图片慢加载、弹窗叠加、快速连点、云调用延迟下不穿帮/不死锁
- **Scale**: 1-5
- **Anchors**: 1 = 经常错位或卡死无法继续；3 = 偶发闪烁但可自行恢复；5 = 全流程无卡死、开孔实时跟随、无死路
- **Pass Threshold**: >= 4
- **Evidence**: 弱网/限速 + 连点压测手测

## Open Questions
- [ ] 数据侧确认 gacha_pool 全部奖品在 inventory 归类为 prop（Assumption 依赖项）。
- [ ] 是否需要在上线前提供运营脚本批量给存量用户置 guideCompletedAt（默认不提供）。
