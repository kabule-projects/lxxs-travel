# 扭蛋算法

货币 = 星星。`GACHA_COST=5`。五连 = 5 次独立单抽，共 25 星，**无折扣**。  
扭蛋物品走独立体系：`gacha_pool` + `user_gacha`，与商店 `items` / `user_inventory` 分离。  
动画：转轮 + 光效，点屏跳过。重复 → 物品变暗 + 星星亮起，+1 星。

## 单次抽取

```
1. stars < 5 → 400
2. stars -= 5
3. 按 pity 与权重抽 gacha_pool
4. 若 user_gacha 已有该 gachaId → 不入库，stars += 1（重复转换）
   否则 user_gacha += 1
5. 更新 pity 计数后返回
```

## 保底（三套不互通）

```
pitySR  : 第 10 抽必出 ≥SR
pitySSR : 第 100 抽必出 ≥SSR
pityUR  : 第 200 抽必出 UR

出 SR  → pitySR = 0
出 SSR → pitySR = 0, pitySSR = 0
出 UR  → 三个都 = 0
出 N/R 不重置任何 pity
```

五连循环 5 次上述逻辑，一次扣 25 星（余额不足则整笔拒绝，不做部分抽取）。
