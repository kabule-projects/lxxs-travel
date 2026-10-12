# 项目约定（Agent 必读）

## 核心设计事实

- **道具 = 扭蛋产物，二者是同一个东西**。`items` 表是道具主数据（名字/图标/描述），`gacha_pool` 表是获取途径配置；新道具上线必须同时进 `items` + `gacha_pool`，只进 items 扭蛋机看不到，只进 gacha_pool 会因主数据缺失被过滤。
- 扭蛋产物自动进 `user_gacha` 图鉴和 `user_inventory` 背包；衣柜/图鉴展示的就是扭蛋收藏。
- 唯一例外：**跳过券**（`gacha_pool` 里 `reward: "skipTicket"` 条目）不是道具，不入图鉴/背包，直接累计 `users.skipTickets`。
- 旅行产出走 `food_pools` 类型池体系（`kind: "food"` 带 `type` 标签 + `kind: "typePool"` 共享池），产出按**食物的类型**解析。
- 不迷路率 = `1 - lostRate + 道具加成 + 米字星(0.1)`，clamp [0,1]。道具加成**二选一**：道具类型与食物类型相同 +20%（`sameTypeBonus`，**包含**基础加成，不再另加），否则每个道具 +5%（`flatPropBonus`）。数值在 `food_pools` kind=config。道具类型由 `propBond.bondedFood` 推导（"道具和食物同排就是一类"）；老字段 bondedBonus/otherBonus 已废弃。
- 内容调整优先改数据库配置，不改代码：旅行概率/卡池改 `food_pools`，扭蛋概率改 `gacha_pool`，商店改 `items` 的 price/shopCategory。

## 工作约定

- 云端改动（云函数/数据库配置）必须 mock 验证 + 部署 + 回读线上确认。
- 小程序无本地假数据兜底：云端失败直接报错可见。
- 测试账号：users 表 `_id` ≠ openid，`userId` 用 openid；狗头鹰 openid=`o-PoB7ficAMgC0AfBP1c1LG3sPUo`（gm=true）。
