/** 与 shared/constants.ts 保持同步 */
export const GAME = {
  NAME: '旅行小深',
  CHARACTER: '深深',
  TZ: 'Asia/Shanghai',
  STAR_CAP: 20,
  STAR_INTERVAL_MIN_MS: 600_000,
  STAR_INTERVAL_MAX_MS: 7_200_000,
  STAR_PENDING_CAP: 5,
  STAR_DROPPED_CAP: 20,
  STAR_PLUS_ONE_MS: 2_000,
  RICE_STAR_RATE: 0.0929,
  SHOP_PAGE_SIZE: 6,
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
  PIGEON_MAIL_CAP: 5,
  IMAGE_FORMAT: 'webp',
  SHOWCASE_SHELVES: 4,
  SHOWCASE_PER_SHELF: 2,
  SHOWCASE_PAGE_SIZE: 8,
  DESIGN_LOGIC_W: 440,
  DESIGN_LOGIC_H: 956,
  DESIGN_PX_W: 1320,
  DESIGN_PX_H: 2868,
  IDLE_POSES: ['bed', 'table', 'window', 'desk'] as const,
  APP_VERSION: '1.0.01',
} as const;

export const SHOP_TABS = ['all', 'food', 'accessory', 'equipment'] as const;

export const SHOP_TAB_LABELS: Record<(typeof SHOP_TABS)[number], string> = {
  all: '全部',
  food: '食物',
  accessory: '饰品',
  equipment: '装备',
};

export default GAME;
