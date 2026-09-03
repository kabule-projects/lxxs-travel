---
name: shen-shen-travel
description: >-
  微信小程序「旅行小深」挂机养成游戏开发规范。涵盖页面、组件、云函数、独立 Web 后台、
  事件总线与核心算法。在实现星星、商店、背包出行、旅行、明信片、扭蛋、展示柜、
  衣柜、屋顶、Loading、GM、内部配置工具时使用。
---

# 旅行小深 · 开发 Skill

## 项目定位
低干预挂机养成：收集星星 → 商店购物 → 打包行李 → 离线旅行 → 明信片惊喜。
游戏名 **旅行小深**，角色 **深深**。唯一货币 **星星**。米字星是收藏品，不流通。

## 技术栈（固定，勿替换）
- 前端：微信原生小程序 + TypeScript
- 后端：微信云开发 CloudBase（云函数 + 云数据库）
- 内部工具：独立 Web（`admin-web/`，Vite + React），不进小程序
- 状态：Store + EventBus
- 时间：业务日 **UTC+8**；旅行结束、星星生成、抽奖结果 **必须服务端计算**

## 目录约定
```
miniprogram/pages/{loading,home,shop,gacha,wardrobe,showcase,roof,diary,tollgate}/
miniprogram/components/{bag-modal,confirm-modal,showcase-detail,depart-modal,star-counter,coconono-bubble,notebook-panel,character-sprite,star-item,loading-frame}/
miniprogram/services/  store/  utils/  types/
cloud/functions/{login,roof,shop,trip,postcard,gacha,scheduler,gm,admin}/
admin-web/             独立配置后台
shared/{constants.ts,types.ts}
```

## 全局事件（GameEvent）
```
STARS_UPDATED | STAR_COLLECTED | TRIP_STARTED | TRIP_RETURNED
POSTCARD_DELIVERED | POSTCARD_CLAIMED | CHARACTER_HIDDEN | CHARACTER_VISIBLE
INVENTORY_CHANGED | BAG_PREPARED
```

## 开发顺序（严格按 Sprint）
0 脚手架 → 1 Loading/主页 → 2 屋顶星星 → 3 商店 → 4 背包出行
→ 5 旅行离线/明信片投递 → 6 展示柜/衣柜/日记 → 7 扭蛋 → 8 联调

每完成一项，更新仓库根目录 [PROGRESS.md](../../../PROGRESS.md)。

## 铁律（违反即 bug）
1. 唯一货币是星星；扭蛋 5 星/抽，五连 25 星无折扣；米字星只收藏
2. 星星生成/掉落间隔 10min–2h 随机；空中最多 5 颗未掉落，地上最多 20 颗可收集；钱包数量以服务端为准
3. 商店每页 6 个，每日每种限购 1（UTC+8 0 点日切）；格子只显示图和价；选中后下端左侧显示名称与简介
4. 食物/装备只提供范围与权重，具体时长/目的地/明信片服务端抽样
5. 旅行不可催回；明信片途中由屋顶**鸽子信箱**接收（最多 5 封未读，超限旧信自动已读进日记）；日记同一 postcardId 只解锁一次
6. 保底 10=SR / 100=SSR / 200=UR，三套不互通；重复食物转 1 星；V1 奖池仅食物
7. 场景全部分层拼接；Loading 与屋顶是同一场景不同状态
8. 不支持机走 tollgate；有音效无 BGM；角色图/分层图由美术提供
9. 猫/桌/签到：只留云函数空接口，不进 MVP 交互；服装影响明信片为 V2
10. 配置增删改只走独立 Web 后台，禁止在小程序里做运营后台

## 锁定常量
见 `shared/constants.ts`。关键值：
- `RICE_STAR_RATE = 0.0929`
- `POSTCARD_SECOND_RATE = 0.929`
- `IMAGE_FORMAT = webp`（**全部**图片，非仅明信片）
- 设计基准 iPhone 17 Pro Max：440×956 逻辑点，1320×2868 @3x
- **全项目图片统一 WebP**（`IMAGE_FORMAT`）；路径用 `utils/asset-path.ts`

## 页面要点
- **Loading/屋顶**：同场景分层；Loading 用动态框；**进入游戏后先到屋顶**；屋顶顶栏为星星数量 + 物品 + 设置（无左上返回）；未掉落星星在夜空倒计时，掉落后点收；**小屋入口在右下**；烟囱旁魔术帽+鸽子为未读信箱（最多 5 封，NEW 标记）
- **商店**：上层 coconono **两人同屏**（可点出头顶台词）；中部 Tab + 每页 6 格；选中后下端左侧名称/简介、右侧购买；**扭蛋仅从商店进入**；仅左上返回
- **主页**：无扭蛋入口；导航为商店 / 日记 / 屋顶 / 展示柜 / 衣柜；准备打开打包弹窗；出发/归来提示条各显示 5 秒
- **出行流程**：准备 → 填背包 → 出发 → 提示条「小深出门旅行了」显示 5 秒；归来 → 同一提示条「小深回来了」5 秒；屋顶出发有鸽子飞走动画，小屋出发仅留空帽子
- **鸽子信箱**：途中回窝叼信；点开未读列表后嘴上的信消失；超 5 封旧信自动已读（收下进日记）；列表按投递时间倒序
- **展示柜**：木柜 4 层×每层 2（每页 8）；仅图标；左右滑翻页；点开详情弹窗（标题/图/简介，右上关闭，无确定）；仅左上返回
- **衣柜 V1**：空态（服装来自扭蛋，V1 奖池无服装）
- **日记**：笔记本 3 列网格；点图放大 ~75%；信封看信；按获取时间排序；返回小屋

## 算法文档
- [屋顶星星](algorithms/roof-stars.md)
- [商店购买](algorithms/shop-purchase.md)
- [旅行系统](algorithms/travel-trip.md)
- [明信片/日记](algorithms/postcard-diary.md)
- [扭蛋](algorithms/gacha.md)
- [背包出行](algorithms/bag-depart.md)
- [资源与适配](algorithms/assets-device.md)
- [宅家姿势](algorithms/idle-pose.md)
- [后台与 GM](algorithms/admin-gm.md)

## Sprint
执行某 Sprint 时读取 `sprints/sprint-XX-*.md`，并遵守本文件铁律。

## 不要做
- 不要恢复「幸运币」独立货币
- 不要做签到页、桌子玩法、猫串门玩法（MVP）
- 不要给玩家「催深深回家」按钮
- 不要把配置工具做进小程序
- 不要用客户端本地时间触发旅行结束或星星入库
