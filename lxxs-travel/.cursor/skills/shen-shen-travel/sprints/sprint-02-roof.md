# Sprint 2 · 屋顶星星

## 前置
Sprint 1。算法：roof-stars.md

## 产出
- pages/roof 与 Loading 共用 sky/rooftop 层
- 顶栏：星星数量 + 物品 + 设置（无视左上返回）
- 中段：最多 5 颗 pending，倒计时 10min–2h 后掉落
- 人物无交互；旁侧 dropped 凌乱堆叠，最多 20，逐颗点收
- 收取 +1 显示 2s；连点则打断上一次 +1
- 左下准备 → 出发弹层；右下商店 / 小屋
- cloud/functions/roof sync + collect
- 米字星入 riceStars，不加星星

## 验收
pending ≤ 5、dropped ≤ 20；刷新后与服务端一致；不能一键全收。
