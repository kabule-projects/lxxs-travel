# 旅行算法



食物/道具只提供**范围与权重**，具体目的地 / 时长 / 明信片由服务端按**数据库配置**抽样。  

引擎：`cloud/functions/common/trip-engine.js`。目录说明：`cloud/collections.md`。



## 状态机



`traveling → returned → at_home`  

玩家**不能催回**。出发/归来**共用同一居中提示条**，仅在触发时显示 **5 秒**（旅行期间不持续显示）；归来后自动 `claimHome`。



## 前置



`loadout.bento` 必填；`riceStar` / `props[≤2]` 选填；已有 traveling 则拒绝。  

库存先校验再扣除；`requestId` 可幂等。



## 配置来源



| 来源 | 内容 |

|------|------|

| `game_config.key=trip` | 距离匹配乘数、米字星乘数、第二张明信片基础概率、投递时刻比例等 |

| `items` | food 距离/时长；prop 的 terrainBias / postcardBias / secondPostcardRateBonus / destWeightMul |

| `destinations` | baseWeight、terrainTags、distanceTier、时长、souvenirPool |

| `postcards` | baseWeight、groupId、可选 destId、稀有度 |



缺省回退见引擎 `DEFAULT_TRIP_CFG`（与 `POSTCARD_SECOND_RATE=0.929` 等常量对齐）。



## 目的地



```

score(dest) = dest.baseWeight

  * (tier∈food.range ? distanceMatchMul : distanceMissMul)

  * Π prop.terrainBias[tag]

  * Π prop.destWeightMul

  * (rice ? riceDestMul : 1)

dest = weightedRandom(destinations, score)

```



## 时长



```

range = intersect(food.durationMin/Max, dest.durationMin/Max)

durationH = uniform(range.min, range.max)

endAt = startAt + durationH * 3600000

```



## 明信片（出行时预生成）



```

secondRate = clamp01(secondPostcardRate + Σprop.bonus + riceBonus)

n = 1 + (rand < secondRate ? 1 : 0)



score(card) = card.baseWeight

  * Π postcardBias.weight(groupId)   // food + props

  * (card.destId == dest.id ? destMatchMul : 1)

  * (rice ? ricePostcardMul * riceRarityMul[rarity] : 1)



deliverAt = startAt + uniform(minRatio, maxRatio) * duration

status: pending → delivered → claimed

```



## API



- `trip/start` `{ loadout, requestId? }` → 写 trips + 扣库存  

- `trip/sync|current` → 推进投递与 returned  

- `postcard/listDelivered` / `claim` / `diary`



## 种子数据



`cloud/seed/trip-catalog.json`（云函数内副本：`common/seed/`）  

Admin：`seedTripCatalog` 幂等 upsert。



## 归来



`now >= endAt` → returned；伴手礼从 `dest.souvenirPool` 抽 1（scheduler / Sprint 5 细化）。


