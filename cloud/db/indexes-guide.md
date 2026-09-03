# 云数据库索引速查表

> 源文件：`cloud/db/indexes.json`。在云开发控制台 → 数据库 → 选中集合 → 索引管理 中按此表创建。

## 字段说明

| 源文件字段 | 含义 |
|-----------|------|
| `collection` | 集合名 |
| `fields[].name` | 索引字段名 |
| `fields[].order` | 排序方向：`asc` 升序，`desc` 降序 |
| `unique` | 是否唯一索引：`true` 唯一，`false` 非唯一 |
| 索引名称 | 控制台要求自定义，推荐按“字段名_排序”命名，如 `openid_asc` |

## 控制台录入格式

```
索引名称：openid_asc
索引属性：唯一索引
索引字段：openid（升序）
```

```
索引名称：enabled_shopSort_asc
索引属性：非唯一索引
索引字段：enabled（升序）、shopSort（升序）
```

---

## 索引清单

### users

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `openid_asc` | 唯一索引 | `openid` 升序 |
| `userId_asc` | 唯一索引 | `userId` 升序 |

### items

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `id_asc` | 唯一索引 | `id` 升序 |
| `enabled_shopSort_asc` | 非唯一索引 | `enabled` 升序、`shopSort` 升序 |

### destinations

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `id_asc` | 唯一索引 | `id` 升序 |
| `enabled_asc` | 非唯一索引 | `enabled` 升序 |

### postcards

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `id_asc` | 唯一索引 | `id` 升序 |
| `enabled_asc` | 非唯一索引 | `enabled` 升序 |

### game_config

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `key_asc` | 唯一索引 | `key` 升序 |

### user_inventory

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_itemId_asc` | 唯一索引 | `userId` 升序、`itemId` 升序 |

### user_showcase

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_itemId_asc` | 唯一索引 | `userId` 升序、`itemId` 升序 |
| `userId_obtainedAt_asc` | 非唯一索引 | `userId` 升序、`obtainedAt` 升序 |

### user_postcards

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_postcardId_asc` | 唯一索引 | `userId` 升序、`postcardId` 升序 |

### user_outfits

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_outfitId_asc` | 唯一索引 | `userId` 升序、`outfitId` 升序 |

### user_gacha

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_gachaId_asc` | 唯一索引 | `userId` 升序、`gachaId` 升序 |

### roof_stars

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_status_asc` | 非唯一索引 | `userId` 升序、`status` 升序 |

### trips

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_status_asc` | 非唯一索引 | `userId` 升序、`status` 升序 |

### daily_purchases

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `userId_itemId_dayKey_asc` | 唯一索引 | `userId` 升序、`itemId` 升序、`dayKey` 升序 |

### idempotency

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `key_asc` | 唯一索引 | `key` 升序 |

### copy_pool

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `type_enabled_asc` | 非唯一索引 | `type` 升序、`enabled` 升序 |

### gacha_pool

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `enabled_asc` | 非唯一索引 | `enabled` 升序 |

### asset_manifest

| 索引名称 | 属性 | 字段 |
|---------|------|------|
| `path_asc` | 唯一索引 | `path` 升序 |
