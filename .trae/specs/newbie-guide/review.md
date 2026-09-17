# 新手指引 代码审查记录（review.md）

审查方式：独立只读 Task agent（general_purpose_task）全量代码走查，结论后由实施方逐项复核修复，再进行二轮定点复审。

## 一轮审查发现与处置

### Blocker（已修复）

| 编号 | 问题 | 修复 |
|---|---|---|
| B1 | cloud/functions/shop/index.js 的 purchase 使用了未声明的 `guideMode`，教学购买必抛 ReferenceError（已扣星后回滚），第 4 步必卡死 | 服务端按 `!user.guideCompletedAt` 自行判定 guideMode（不信任客户端）；daily_purchases 插入同步打 guide 标记 |
| B2 | cloud/functions/gacha/index.js 的 draw 同样 `guideMode` 未定义；首抽抛错后客户端静默回落本地扭蛋，云端扣款 5 星但库存未落，数据永久分叉 | draw 内同样按用户完成标志服务端判定 guideMode，user_gacha/user_inventory 正常打标 |
| B3 | login 云函数 switch 未接 completeGuide，云端 guideCompletedAt 永不写入；本地标志丢失后老用户再进 roof 会被 resetGuideProgress 清零存量经济 | login/index.js switch 增加 `case 'completeGuide'`；幂等回写已存在 |

### Major（已修复）

| 编号 | 问题 | 修复 |
|---|---|---|
| M4 | gacha-result 组件 refreshGuideHost 误传 host `'gacha'`，元数据 host 为 `'gacha-result'`，第 7 步无开孔/气泡 | 改传 `'gacha-result'` |
| M5 | guide-overlay 上/下遮挡条未显式 width，绝对定位空内容塌缩为 0 宽，黑罩"看得见点得穿" | `.go-bar { width: 100% }`（左右条内联 width 不受影响） |
| M6 | 系统返回/胶囊返回未拦截，navigateTo 链上中途退出会步骤与页面错位，永久软锁 | 新增 setGuideBackGuard（wx.enableAlertBeforeUnload，低版本静默失败）；roof/shop/gacha/home 按宿主接线；另加三层自愈：roof onShow 检测 shop/gacha 步自动回带商店、shop onShow 检测 gacha 步自动回带扭蛋（gacha onShow 将无弹窗的 gacha-result 退回 gacha-draw）、home onShow 检测 bag/picker 步重开背包并归一到 bag-food/bag-prop |
| M7 | roof 星星标记类打在 star-item 自定义组件宿主节点上，内部根节点 position:absolute 导致宿主 0×0，测量被 0 尺寸过滤剔除，第 1 步永久全屏阻挡 | star-item 开启 `options.virtualHost`（基础库 3.7，远高于 2.19.2 要求），并在组件内部根节点直接追加 `guide-star--dropped` 类，双保险；定位仍为相对 sky-layer 的绝对定位，布局不变 |

### Minor（处置）

| 编号 | 问题 | 处置 |
|---|---|---|
| M8 | roof onUnload 未退订 GUIDE_CHANGED、未清 _guideTimer | 已补 _offGuide?.() + clearTimeout + 关闭返回拦截 |
| M9 | 本地重置漏清 lxxs_gacha_owned / lxxs_gacha_pity，离线兜底模式断点重开扭蛋持有/保底残留 | 已加入 LOCAL_ECONOMY_KEYS（静态奖池 pool 不清） |
| M10 | guide-overlay 使用未声明的 _shakeTimer，detached 未清理 | 已补实例字段与 detached 清理 |
| M11 | reset 删 potato daily_purchases 不限 guide 标记 | 维持现状（教学口径内可接受；云端购买记录现在也带 guide 标记，后续可收紧） |
| M12 | gacha-result 多次 setData 可合并 | 不修（无功能问题，最小 diff） |
| Nit | bag-modal setData 未声明 riceIcon（既有）；shop anchor 不硬校验 potato id（依赖 shopSort 首件） | 不修：riceIcon 为既有问题；云端 listItems 按 shopSort asc 首件即 potato，本地兜底种子首件为唯一可购食物，均与选择器同源 |

## 修复后核查

- 四个云函数 `node -c` 全部通过；common/ 未改动，无需重新 sync-cloud-common。
- tsc 增量：新增代码无新类型错误（仅剩项目基线噪音：Component 全局、WechatMiniprogram 事件命名空间、历史 implicit any）。
- GetDiagnostics（IDE 口径）：guide-page.ts / guide.ts / guide-overlay 无错误。

## 待用户在微信开发者工具 + 配云环境真机/模拟器验证

1. **全新账号完整 13 步**：roof 9 星（8 普通+1 米）→ shop potato 扣 3 → gacha 单抽扣 5 → 确认后 reLaunch home → 背包食物 potato + 道具槽 0 → GO 真实出发；遮罩开孔位置/气泡每步正确，开孔外点击只 toast+抖动。
2. **第 1 步开孔实测**（M7）：9 颗星的白框与点击热区准确（virtualHost 后重点回归项）。
3. **云端落库**：user_inventory / user_gacha 记录带 guide:true；users.guideCompletedAt 在出发后有值；余额 8−3−5=0、riceStars=1。
4. **断点重开**：分别在捡星后/购买后/抽奖后/背包步杀进程重进 → roof sync 触发 reset+重播 9 星，本地缓存清零，从第 1 步重来。
5. **系统返回**：shop/gacha 页硬件返回/胶囊返回弹原生确认；选"离开"后 onShow 自愈把流程带回正确页面。
6. **老账号回归**：guideCompletedAt 已有的账号任何页面无遮罩、购买/扭蛋不带 guide 标记；清本地缓存重登不触发 reset。
7. 部署云函数：**login / roof / shop / gacha**（4 个）。
