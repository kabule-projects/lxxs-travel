# 新手指引（强制式遮罩教学）- 实施计划

## Task 1: 云端 — 用户字段、9 星播种、完成回写
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `cloud/functions/login/common/user.js`：mapUserPublic 输出 `guideCompletedAt`（缺省 null）。
  - `cloud/functions/login/index.js`：createUser/register 新档带 `guideCompletedAt: null`、`guideSeededAt: null`；新增 action `completeGuide`：置 users.guideCompletedAt=now（按 OPENID）。
  - `cloud/functions/roof/index.js`：syncStars 中，当 `!user.guideCompletedAt && !user.guideSeededAt` 时插入 9 颗 `type:'normal', status:'dropped', guide:true` 星星（位置循环 randomPilePos(dropped.length+i)），置 users.guideSeededAt；返回 `guideDropped`（dropped 中 guide:true 计数）。幂等：先置 flag 再插星，异常路径不重复发放。
  - 部署前运行 `node scripts/sync-cloud-common.js`，上传部署 login 与 roof。
- **Acceptance Criteria Addressed**: AC-2, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-1.1: 全新 openid 首次调 roof sync 返回 8 颗 guide dropped 普通星 和 1 颗 rice 星，第二次 sync 不新增；证据=云函数云端测试连续两次返回 + roof_stars 计数
  - `rule` TR-1.2: login session 返回体含 guideCompletedAt；completeGuide 后再次 session 该字段为时间戳；证据=云端测试返回 JSON
  - `rule` TR-1.3: 9 星全部 collect 后余额为 9 且 guideDropped=0；证据=collect 调用序列后 users.stars
- **Notes**: common/user.js 同步后其他函数无需重新部署（仅导出字段变化，向后兼容）。

## Task 2: 客户端数据层 — UserProfile 字段与 guide 状态机服务
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `services/api.ts` 的 UserProfile 增加 `guideCompletedAt?: number | null`、`guideDropped?: number`（roof sync 视图类型在 services/roof.ts RoofSyncResult 增加 guideDropped）。
  - 新增 `services/guide.ts`：
    - 状态：`active:boolean`、`step:GuideStep`（13 步枚举 union）；模块级单例。
    - `initFromProfile(profile)`：guideCompletedAt 或本地 `lxxs_guide_completed` 有值 → 永久关闭；否则在进入屋顶时 `start()`。
    - `start()/isActive()/isStep(s)/getStep()/advance(next)/complete()`；complete 调 login `completeGuide`（失败只写本地不阻断），并广播 `GameEvent.GUIDE_CHANGED`（event-bus 增枚举）。
    - 步骤元数据表：id、所属页面（roof/shop/gacha/home/bag-modal/inventory-picker/gacha-result）、目标选择器（可多个）、放行矩形策略（'bbox' | 'roof-band'）、中文气泡文案。
    - 重启快进判定辅助：roof 步依据 roof 返回的 guideDropped===0；shop 步依据 food_bento_a 的 boughtToday（页面数据提供 check 函数 `shouldFastForward(step, ctx)`）。
  - 本地兜底常量 `lxxs_guide_completed`、`lxxs_guide_seeded`。
- **Acceptance Criteria Addressed**: AC-1, AC-8
- **Test Requirements**:
  - `rule` TR-2.1: profile 无完成字段时 start 后 isActive=true、step 为第一步；置位后任何 start 无效；证据=DevTools console 调用 getter 输出
  - `rule` TR-2.2: complete 后本地存储有值，刷新会话 initFromProfile 不再激活；证据=Storage 面板 + 重新编译
  - `rule` TR-2.3: TypeScript 编译无新增诊断错误；证据=GetDiagnostics

## Task 3: 本地兜底 — roof 本地模式播种 9 星
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2
- **Description**:
  - `services/roof.ts`：LocalState 增加 `guideSeeded?: boolean`、星结构允许 guide 字段；localSync 中当本地无完成标志且 !guideSeeded 时注入 9 颗 dropped 普通星（位置复用 randomPilePos，guide:true）并置 guideSeeded；返回 guideDropped 计数。
  - localCollect 对 guide 星不做特殊处理。
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `rule` TR-3.1: 未配云环境（或云失败）时本地 sync 首次返回 9 颗 dropped，再次不增加；证据=断网/控制台模拟 + lxxs_roof_local 内容

## Task 4: guide-overlay 通用遮罩组件
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 新增 `components/guide-overlay/`（wxml/wxss/ts/json）：
    - properties：`visible`、`holes: Array<{x,y,w,h,r?}>`（视口 px）、`hitRect:{x,y,w,h}`（缺省=holes 外接矩形）、`text:string`。
    - 结构：fixed 全屏容器 z-index 9999；视觉层每个 hole 一个透明 view（白色圆角描边 + 外圈巨大 box-shadow 形成 0.72 黑罩 + CSS 脉冲缩放动画），pointer-events:none；交互层为 hitRect 四周四块 catchtap 遮挡条（吞点击，触发 `blocked` 事件供页面 toast/抖动）。
    - 气泡：深棕/黑底白字圆角，自动选择 hitRect 上方或下方（空间不足翻转），带小三角；font 用项目既有黑体族。
  - 提供工具函数 `measureSelectors(componentThis, selectors[]): Promise<Rect[]>`（封装 createSelectorQuery().in(this).selectAll/select boundingClientRect）放在组件 ts 导出或 utils/guide-measure.ts。
- **Acceptance Criteria Addressed**: AC-3, AC-9
- **Test Requirements**:
  - `rule` TR-4.1: 单孔场景孔内按钮可点、孔外四处点击均被吞；多孔（9 孔）场景视觉开孔数量/位置与传入 rect 一致；证据=组件最小演示页或临时挂在 roof 的手测
  - `rubric` TR-4.2: 视觉质量维度；1-5；anchors 同 AC-9；阈值 >=4；证据=两机型截图

## Task 5: roof 页接入指引（星星拾取 → 商店入口）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - `pages/roof/index`：注册 guide-overlay；onShow 会话后 `guide.initFromProfile/start`；订阅 GUIDE_CHANGED。
  - roof-stars：每次 starItems setData 后测量全部 `star-item` 宿主节点作为 holes；hitRect 用屋顶星星活动带（固定一条中间区域，按现有星星落点百分比计算，落在 utils 常量）。
  - syncFromServer 读到 guideDropped===0 且当前为 roof-stars → advance 到 roof-to-shop；roof-to-shop 测量底部商店按钮（在 wxml 给商店按钮加 class `guide-anchor-shop`），单孔。
  - 防御：onTapShop 在非 roof-to-shop 步骤直接 return；其余按钮被遮罩物理阻挡。
  - loading 进入后第一步即激活，不闪旧屏：遮罩在首次测量完成前先全屏不可点（visible 且 holes 空）。
- **Acceptance Criteria Addressed**: AC-1, AC-3, AC-4, AC-8
- **Test Requirements**:
  - `rule` TR-5.1: 9 星未捡完商店/设置/背包/鸽子等均不可点；捡完自动切孔到商店按钮并可点进 shop；证据=手测录屏
  - `rule` TR-5.2: 拾取过程中每少一颗星，开孔数量/位置实时更新不漂移；证据=连续点击观察
  - `rubric` TR-5.3: 同 AC-10 健壮性，屋顶步骤；阈值 >=4；证据=弱网图片慢加载手测

## Task 6: shop 页接入（选物 → 购买 → 扭蛋入口）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 5
- **Description**:
  - `pages/shop/index`：注册 guide-overlay；onShow/onLoad 按 guide 状态与列表数据进入 shop-select（首格）/shop-buy/shop-to-gacha；已购 food_bento_a 时快进至 shop-to-gacha。
  - WXML：第一页第一格追加 class `guide-anchor-cell`（wx:for index 判断 pageIndex/shelf/cell=0,0,0）；购买按钮加 `guide-anchor-buy`；扭蛋侧钮加 `guide-anchor-gacha`。
  - 测量时机：reloadList setData 后 nextTick + 图片 load 后重测。
  - 防御：onTapItem 指引中仅放行 anchor 物品 id；onTapBuy 仅在 shop-buy 放行；onTapGacha 仅在 shop-to-gacha 放行；onTapBack/settings/bag 指引中拦截。
  - 购买成功回调里 advance 到 shop-to-gacha。
- **Acceptance Criteria Addressed**: AC-3, AC-5, AC-8
- **Test Requirements**:
  - `rule` TR-6.1: 非首格点击不选中；购买成功扣 3 星并切换开孔到扭蛋钮；证据=stars 数值与开孔切换
  - `rule` TR-6.2: 重开且 food_bento_a boughtToday=true 时进入 shop 自动落到 shop-to-gacha；证据=模拟重开手测

## Task 7: gacha 页 + gacha-result 接入（单抽 → 强制确认 → 回小屋）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 6
- **Description**:
  - `pages/gacha/index`：gacha-draw 步骤对单抽按钮（加 `guide-anchor-draw1`）开孔；五连/返回/图鉴/设置在遮罩下。
  - 防御：onTapDraw 指引中拒绝 count=5；onTapBack/onTapPrizes 拦截。
  - `components/gacha-result`：新增 property `forceConfirm`（指引中 true）：隐藏关闭 X；组件内部在确认按钮（加 class 供测量）上渲染自带的 guide-overlay（或抛出 confirm 按钮 rect 由页面遮罩渲染——组件隔离，采用组件内渲染，文案由 guide 服务提供）。
  - onConfirmResult：若指引中 → 关闭弹窗 + guide.advance + `wx.reLaunch({url:'/pages/home/index'})`。
- **Acceptance Criteria Addressed**: AC-3, AC-6, AC-10
- **Test Requirements**:
  - `rule` TR-7.1: 五连与其他出口不可点；单抽后结果弹窗无 X，点确认后落在 home 且栈深度 1；证据=getCurrentPages 与录屏
  - `rule` TR-7.2: 动画 6s 期间遮罩保持、跳过按钮被遮罩盖住不可点；证据=手测

## Task 8: home + bag-modal + inventory-picker 接入（背包 → 食物 → 道具 → GO）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 7
- **Description**:
  - home：home-bag 步骤对 side-btn-bag（加 `guide-anchor-bag`）开孔；其余热区拦截；reLaunch 落地 onShow 后启动测量。
  - `components/bag-modal`：visible 且指引中按步骤渲染组件内 guide-overlay：bag-food 孔=`.slot-food`、bag-prop 孔=`.slot-prop0`、bag-depart 孔=`.depart-btn-img`；非当前槽位的 catchtap 被组件自身遮罩吞掉；选择完成（onPickerSelect 回填）推进步骤；onDepart/startTrip 成功事件后 guide 步骤推进交给页面。
  - `components/inventory-picker`：新增指引感知（读 guide 服务）：picker-food/picker-prop 步骤锁定对应 tab（lock-tab 已有），仅首个格子（列表 index 0，加 guide class）可点，组件内遮罩开孔；点中即正常 select 并推进。
  - home `onBagDepart` startTrip 成功后调 `guide.complete()`，遮罩全部消失；bag 关闭键在指引步骤中禁用（防止退出弹窗中断流程）。
- **Acceptance Criteria Addressed**: AC-3, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-8.1: 顺序错误时点食物槽以外区域无反应；装好食物→道具后 GO 可点，出发成功遮罩消失且 guideCompletedAt 落库；证据=users 文档 + 旅行态 UI
  - `rule` TR-8.2: picker 中第二件及以后物品不可点、tab 不可切换；证据=手测
  - `rule` TR-8.3: 抽奖得到的道具出现在 prop tab 第一位（或数据配置确认）；证据=picker 列表目视

## Task 9: 联调、断点续跑与回归
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1-8
- **Description**:
  - 全新账号端到端走通 13 步（DevTools + 真机），核对余额 9→6→1。
  - 三处断点（捡星后/购买后/抽奖后）杀进程重开，验证从首步重开、自动快进、不重复扣费/播种。
  - 回归：完成账号全页面无遮罩、功能与现状一致；catchtouchmove 禁滚动未受影响；所有弹窗（settings/邮件/图鉴/结果）正常。
  - GetDiagnostics 无新增 TS 错误；删除所有调试 class 之外的临时代码。
- **Acceptance Criteria Addressed**: AC-1~AC-10
- **Test Requirements**:
  - `rule` TR-9.1: 端到端通关一次且完成标志生效、二次进入无指引；证据=完整录屏/手测记录
  - `rule` TR-9.2: 三断点续跑全部成功且无重复扣费；证据=余额与库存核对表
  - `rubric` TR-9.3: 回归质量；1-5；1=完成账号出现遮罩或老功能损坏，3=轻微瑕疵，5=零回归；阈值 >=4；证据=完成账号冒烟清单
