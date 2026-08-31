# 商店购买算法



`SHOP_PAGE_SIZE=6`，`DAILY_BUY_LIMIT=1`，日切 **UTC+8 00:00**。



## 列表 `shop/list`



```

按 shopSort 排序；tab=all 混排，否则按 shopCategory 过滤

一次返回当前 tab 全部商品（≤200）；前端按 6 个一页滑动翻页

每项：id, icon, price, name, description, shopCategory, boughtToday

另返回 stars, pageSize, total, totalPages, dayKey

中部格子只展示 icon + price；选中后下端左侧展示 name + description

```



## 选中（客户端）



```

高亮选中格；下端左侧 title/description

buyButton.enabled = 已选中 且 stars >= price 且今日未买过

人物点击：随机一句 shop_talk（copy_pool），显示在人物头顶

```



## 购买（幂等）`shop/purchase`



```

输入: itemId, requestId

1. 已处理的 requestId → 返回原结果

2. 今日 daily_purchases 已有该 item → DAILY_LIMIT

3. stars < price → INSUFFICIENT_STARS

4. stars -= price; user_inventory += 1; 写 daily_purchases; 记幂等

价格只来自 items 表，代码不写死。

```


