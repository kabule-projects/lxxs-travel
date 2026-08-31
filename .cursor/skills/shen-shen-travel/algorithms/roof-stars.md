# 屋顶星星算法

常量见 `shared/constants.ts`：

- 生成/掉落间隔 `uniform(10min, 2h)`
- 空中未掉落 `STAR_PENDING_CAP = 5`
- 地上可收集显示 `STAR_DROPPED_CAP = 20`
- 米字星 `RICE_STAR_RATE = 0.0929`
- 收取 `+1` 展示 `STAR_PLUS_ONE_MS = 2000`

星星分两态：**pending**（空中倒计时）→ **dropped**（人物旁可点）→ **collected**。

## 生成与掉落（服务端 `roof/sync`，onShow / 每秒客户端对表）

```
输入: userId, now, nextSpawnAt
pending = status=pending 且未收集
dropped = status=dropped 且未收集

1. 掉落：pending 中 dropAt <= now 且 dropped.length < 20
     → status=dropped，写入凌乱 pile 坐标 (x,y,rotate)
2. 生成：while now >= nextSpawnAt AND pending.length < 5:
     type = random() < 0.0929 ? 'rice' : 'normal'
     dropAt = now + random(10min, 2h)
     写入 pending { skyX, skyY, dropAt }
     nextSpawnAt = now + random(10min, 2h)
3. pending 已满则 nextSpawnAt = now + random(10min, 2h)（等空位）
禁止客户端把数量直接写入 stars 钱包。
```

## 收取（每次只收 1 颗 dropped）

```
1. star 必须属于该用户且 status=dropped，否则 409
2. 事务：status=collected
   normal → users.stars += 1
   rice   → users.riceStars += 1（不加 stars）
3. 返回最新 stars / riceStars
不可一键全收。连续点：上一颗 +1 立刻关掉，再显示下一颗 +1，各停留 2s。
```

## 客户端

- pending：独立 element + 倒计时 `HH:MM:SS`，不可点
- dropped：独立 element，堆叠错落，最多 20，bindtap 收一颗
- 角色无交互
- Loading 与屋顶同一套 sky / rooftop 分层
