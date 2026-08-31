# 屋顶 WebP

设计基准 iPhone 17 Pro Max。全部 WebP。

| 路径 | 说明 |
|------|------|
| `shared/roof/sky` | 夜空层（星座/渐变，与 Loading 共用） |
| `shared/roof/rooftop` | 屋顶层（深深+伙伴+小屋窗等静态合一） |
| `roof/star` | 空中/地上普通星星 |
| `roof/star-rice` | 米字星 |
| `roof/magic-hat` | 烟囱旁魔术帽 |
| `roof/pigeon` | 鸽子 |
| `roof/pigeon-mail` | 叼信鸽子 |
| `roof/mail-tip` | NEW 提示 |
| `home/btn-prepare` | 底栏「准备」宽按钮 |
| `icons/roof/items` | 顶栏物品 |
| `icons/roof/home` | 底栏回小屋 |
| `icons/home/shop` | 底栏商店 |
| `icons/common/settings-grid` | 顶栏设置 |

## 星星规则（UI）

- **空中**：中间区域随机刷新，带倒计时光晕
- **落下**：固定堆在鸽子左下角，单列表渲染（不重复 element）
- 收取后 `+1` 浮字出现在鸽子旁
