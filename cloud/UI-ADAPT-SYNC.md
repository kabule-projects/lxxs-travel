# 云侧改动同步单 · Roof UI 适配

> 日期：2026-09-04
> 背景：客户端屋顶页（pages/roof）做了多屏比适配改造，落星堆积坐标随装饰位调整。
> 云函数 API 契约、数据库 schema 均**无变化**，仅需同步一处坐标常量并重新部署。

## 1. 需要改动的文件

**唯一改动点：`cloud/functions/common/game.js` 的 `randomPilePos()`**

客户端将鸽子（信箱入口）位置调整为 `right: 5%; bottom: 24%`（相对屏幕），落星堆积区需对准鸽子左下角。请将该函数改为：

```js
function randomPilePos(index = 0) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    // 鸽子 right:5%/bottom:24% 的左下角，百分比相对整屏
    x: 64 + col * 4 + Math.random() * 3 - 1.5,
    y: 73 + row * 1.6 + Math.random() * 2 - 1,
    rotate: Math.floor(Math.random() * 41) - 20,
  };
}
```

旧值（部署环境中当前版本）：

```js
x: 56 + col * 5 + Math.random() * 4 - 2,
y: 52 + row * 4 + Math.random() * 3 - 1.5,
```

说明：
- `x` / `y` 均为相对屏幕宽/高的百分比，与客户端 `miniprogram/utils/roof-logic.ts` 中的同名函数保持一致（客户端该函数为云调用失败时的本地兜底，两份必须一致）。
- `randomSkyPos()`（空中待掉落星星）**未改动**，无需调整。

## 2. 部署步骤

1. 更新 `cloud/functions/common/game.js` 中上述函数；
2. **重新上传部署 `roof` 云函数**（`roof/index.js` 通过 `require('../common/game')` 引用共享目录，需随 common 一起打包上传）；
3. 部署后可调用 `roof` 云函数 `action: 'sync'` 验证：新掉落的星星（status 由 pending → dropped）应写入新坐标。

## 3. 存量数据说明（可选）

已掉落星星的坐标在掉落时已持久化到 `roof_stars` 集合（字段 `x` / `y`），改动函数**不会回溯更新**旧数据：

- 不处理也可以：存量星星被玩家收取后自然消失，新掉落的星星使用新坐标；
- 如需立即一致：可在云开发控制台清空（或删除 status 为 `dropped` 的记录）`roof_stars` 集合，注意这会让玩家场景上暂无落星，等待下一轮刷新即可。

## 4. 不需要改动的部分

- 云函数入参/返回结构、action 列表：无变化；
- 数据库集合与索引：无变化；
- 客户端背景图改为「宽度适配 + 垂直居中」、顶栏避让微信胶囊按钮等，均为纯客户端渲染逻辑，云侧无感知；
- 其他云函数（login / shop / trip / gacha / postcard / scheduler 等）：本次不涉及。

## 5. 客户端对应改动（备查）

| 文件 | 改动 |
|------|------|
| `miniprogram/pages/roof/index.*` | 背景图 widthFix 宽度适配 + 垂直居中；禁滚动；顶栏按胶囊按钮避让；底栏贴安全区 |
| `miniprogram/pages/loading/index.*` | 共用背景图，同步 widthFix + 垂直居中 |
| `miniprogram/utils/device.ts` | 新增 `readCapsuleRect()`（读胶囊按钮矩形），纯客户端 |
| `miniprogram/utils/roof-logic.ts` | `randomPilePos()` 与本同步单第 1 节一致 |
