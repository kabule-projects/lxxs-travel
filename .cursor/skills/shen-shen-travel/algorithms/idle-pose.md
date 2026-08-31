# 宅家姿势随机

深深未旅行时，在房间四个槽位之一刷新，每槽一张独立 WebP。

## 槽位

| pose | 位置 | 资源 |
|------|------|------|
| `bed` | 左下床铺 | `home/shenshen-bed` |
| `table` | 中央圆桌旁 | `home/shenshen-table` |
| `window` | 右上窗前 | `home/shenshen-window` |
| `desk` | 右下电脑桌前 | `home/shenshen-desk` |

常量：`GAME.IDLE_POSES`（等权）。

## 算法

```
pickIdlePose(lastPose?):
  pool = lastPose ? IDLE_POSES.filter(p != lastPose) : IDLE_POSES
  return pool[floor(random() * pool.length)]
```

触发：`pages/home` `onShow` 且 `!isTraveling()`。  
旅行中：不渲染角色。归来后下次 `onShow` 再抽。
