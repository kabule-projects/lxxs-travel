# 明信片与日记算法



稀有度：N / R / SR / SSR / UR。图片 **WebP**（thumb + full）。日记图鉴无过期。



## 屋顶鸽子信箱（交互入口）



烟囱旁魔术帽 + 鸽子。`PIGEON_MAIL_CAP = 5`。



### 鸽子表现



| 状态 | 条件 | 表现 |

|------|------|------|

| away | 小深 traveling 且尚无已投递未读信 | 空帽子（人出门鸽子一起走） |

| mail | 存在 delivered 未读，且尚未点开过信箱（相对最新投递） | 鸽子回窝，嘴上叼信 |

| idle | 非 away，且已点开信箱或无未读 | 鸽子窝在帽子里，无信 |



- **屋顶出发**：帽子处播「鸽子飞出走」短动画 → 空帽子  

- **小屋出发**：进屋顶时直接空帽子，无飞走动画  

- **途中投递**：`pending → delivered` 后鸽子可变为 mail（嘴上有信）  

- **点鸽子**：打开「未读信件」弹窗；点一次后嘴上的信消失（`users.lastMailboxOpenAt = now`）  

- 列表项可点开详情并 `claim`；**新信带 NEW**（`isNew`，查看详情或领取后清除）



### 容量



```

未读 = status==delivered 且未 claimed

按 deliverAt 升序裁剪；超过 5 封时最早的自动已读（claimed + 写入 user_postcards）

信箱列表展示按 deliverAt **降序**（最新在上）

```



## 投递



旅行途中 `now >= deliverAt` → status=delivered，`isNew=true`。  

然后执行容量裁剪。投递入口：屋顶鸽子信箱（不再散落在天台可点 element）。



## 领取



```

POST claim { tripId, instanceId }

未 delivered → 400

标记 claimed；信箱移除

user_postcards:

  若该 postcardId 首次 claimed → 插入图鉴（firstClaimedAt）

  否则 claimCount += 1，日记格不新增

```



## 日记 UI

- 翻页笔记本；**3 列网格**缩略图，从左到右自动换行，可纵向滚动
- 按 `firstClaimedAt` **升序**（获取时间从早到晚）
- 点缩略图：大图约 **75% 屏宽**；右下角信封点开信件正文
- 点外层空白：回到日记网格；左上返回小屋
- 列表只含 firstClaimed 记录（`user_postcards`）


