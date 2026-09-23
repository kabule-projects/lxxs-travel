/** 旅行小深 · 全局常量。前后端共用，禁止在业务代码里写魔法数。 */

export const GAME = {
  NAME: '旅行小深',
  CHARACTER: '深深',
  TZ: 'Asia/Shanghai',
  STAR_CAP: 20,
  /** 旧时间间隔制参数：仅兼容保留（生成已改库存制，见 STAR_STOCK_TARGET） */
  STAR_INTERVAL_MIN_MS: 180_000,
  STAR_INTERVAL_MAX_MS: 1_800_000,
  /** 空中未掉落上限（兼容保留） */
  STAR_PENDING_CAP: 5,
  /** 地上可收集显示上限 */
  STAR_DROPPED_CAP: 20,
  /** 随机节奏生成：同屏总量封顶，不时刻保持满额 */
  STAR_TOTAL_CAP: 10,
  /** 相邻两颗星的生成间隔随机 8–40min */
  STAR_SPAWN_GAP_MIN_MS: 480_000,
  STAR_SPAWN_GAP_MAX_MS: 2_400_000,
  /** 新星在天上停留 10min–4h 随机后落地 */
  STAR_DROP_MIN_MS: 600_000,
  STAR_DROP_MAX_MS: 14_400_000,
  /** 收取 +1 停留 */
  STAR_PLUS_ONE_MS: 2_000,
  RICE_STAR_RATE: 0.2,
  /** 商店中部每页商品数 */
  SHOP_PAGE_SIZE: 6,
  /** 背包：美食 1 / 米字星 1 / 道具 2 */
  BAG_FOOD_SLOTS: 1,
  BAG_RICE_SLOTS: 1,
  BAG_PROP_SLOTS: 2,
  DAILY_BUY_LIMIT: 1,
  GACHA_COST: 5,
  GACHA_MULTI: 5,
  GACHA_DISCOUNT: false,
  PITY_SR: 10,
  PITY_SSR: 100,
  PITY_UR: 200,
  POSTCARD_SECOND_RATE: 0.929,
  /** 屋顶鸽子信箱最多保留未读信 */
  PIGEON_MAIL_CAP: 5,
  /** 全项目图片统一 WebP（UI / 角色 / 场景 / 明信片） */
  IMAGE_FORMAT: 'webp',
  /** 展示柜：4 层 × 每层 2 = 每页 8 */
  SHOWCASE_SHELVES: 4,
  SHOWCASE_PER_SHELF: 2,
  SHOWCASE_PAGE_SIZE: 8,
  DESIGN_LOGIC_W: 440,
  DESIGN_LOGIC_H: 956,
  DESIGN_PX_W: 1320,
  DESIGN_PX_H: 2868,
  /** 宅家随机刷新：床上 / 桌旁 / 窗前 / 电脑桌前，等权 */
  IDLE_POSES: ['bed', 'table', 'window', 'desk'] as const,
} as const;

export const ITEM_TYPES = [
  'food',
  'accessory',
  'equipment',
  'souvenir',
  'rice_star',
] as const;

export const SHOP_TABS = ['all', 'food', 'accessory', 'equipment'] as const;

export const POSTCARD_RARITY = ['N', 'R', 'SR', 'SSR', 'UR'] as const;

/** 明信片展示/交互类型（与 items.type 无关） */
export const POSTCARD_TYPES = ['postcard', 'letter', 'photo', 'special'] as const;

export const DEFAULT_POSTCARD_TYPE = 'postcard' as const;

export const TRIP_STATUS = [
  'preparing',
  'traveling',
  'returned',
  'at_home',
] as const;

export const POSTCARD_STATUS = ['pending', 'delivered', 'claimed'] as const;
