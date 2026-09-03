import GAME, { SHOP_TABS } from '../utils/constants';
import { call } from './api';
import { getStars, setStars } from '../store/user';
import { emit, GameEvent } from '../utils/event-bus';

export type ShopTab = (typeof SHOP_TABS)[number];

export interface ShopItemView {
  id: string;
  icon: string;
  price: number;
  name: string;
  description: string;
  shopCategory: Exclude<ShopTab, 'all'> | string;
  boughtToday: boolean;
}

export interface ShopListResult {
  stars: number;
  tab: ShopTab;
  pageSize: number;
  total: number;
  totalPages: number;
  dayKey: string;
  /** 当前 tab 下全部商品；前端按 pageSize 分页 */
  items: ShopItemView[];
}

export interface ShopPurchaseResult {
  itemId: string;
  price: number;
  stars: number;
  dayKey: string;
}

const STORAGE_KEY = 'lxxs_shop_local';
const INV_KEY = 'lxxs_inventory_local';

const DEFAULT_LINES = [
  '今天也要好好挑选行李呀～',
  '这件很适合深深出门用！',
  '星星攒够了再来买也不迟哦。',
  '欢迎光临 coconono！',
  '买了记得放进背包再出发。',
];

/** 无云配置时的占位货架，便于联调翻页/限购 */
const SEED_CATALOG: ShopItemView[] = [
  {
    id: 'food_bento_a',
    icon: '',
    price: 3,
    name: '普通便当',
    description: '简单的家常便当，出行必带。',
    shopCategory: 'food',
    boughtToday: false,
  },
  {
    id: 'food_bento_b',
    icon: '',
    price: 5,
    name: '豪华便当',
    description: '丰盛一些，旅途更安心。',
    shopCategory: 'food',
    boughtToday: false,
  },
  {
    id: 'food_snack',
    icon: '',
    price: 2,
    name: '路上零食',
    description: '饿了就啃一口。',
    shopCategory: 'food',
    boughtToday: false,
  },
  {
    id: 'acc_scarf',
    icon: '',
    price: 4,
    name: '小围巾',
    description: '暖暖的，适合微凉天气。',
    shopCategory: 'accessory',
    boughtToday: false,
  },
  {
    id: 'acc_hat',
    icon: '',
    price: 4,
    name: '旅行帽',
    description: '遮阳又好看。',
    shopCategory: 'accessory',
    boughtToday: false,
  },
  {
    id: 'acc_badge',
    icon: '',
    price: 2,
    name: '纪念徽章',
    description: '别在衣服上更有精神。',
    shopCategory: 'accessory',
    boughtToday: false,
  },
  {
    id: 'eq_map',
    icon: '',
    price: 6,
    name: '旧地图',
    description: '好像能走到更远的地方。',
    shopCategory: 'equipment',
    boughtToday: false,
  },
  {
    id: 'eq_cam',
    icon: '',
    price: 8,
    name: '拍立得',
    description: '旅途风景更容易留下。',
    shopCategory: 'equipment',
    boughtToday: false,
  },
  {
    id: 'eq_bag',
    icon: '',
    price: 7,
    name: '轻便背包',
    description: '多装一点也不累。',
    shopCategory: 'equipment',
    boughtToday: false,
  },
  {
    id: 'food_tea',
    icon: '',
    price: 3,
    name: '保温壶茶',
    description: '路上喝一口暖暖的。',
    shopCategory: 'food',
    boughtToday: false,
  },
  {
    id: 'acc_glasses',
    icon: '',
    price: 5,
    name: '圆框眼镜',
    description: '看起来更机灵一点。',
    shopCategory: 'accessory',
    boughtToday: false,
  },
  {
    id: 'eq_compass',
    icon: '',
    price: 6,
    name: '小指南针',
    description: '迷路时派得上用场。',
    shopCategory: 'equipment',
    boughtToday: false,
  },
];

interface LocalShopState {
  dayKey: string;
  boughtIds: string[];
}

function businessDayKey(ts = Date.now()): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  const d = new Date(ts + offsetMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeRequestId(): string {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readLocal(): LocalShopState {
  const dayKey = businessDayKey();
  try {
    const raw = wx.getStorageSync(STORAGE_KEY) as LocalShopState | '';
    if (raw && typeof raw === 'object' && raw.dayKey === dayKey) {
      return {
        dayKey,
        boughtIds: Array.isArray(raw.boughtIds) ? raw.boughtIds : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { dayKey, boughtIds: [] };
}

function writeLocal(state: LocalShopState) {
  try {
    wx.setStorageSync(STORAGE_KEY, state);
  } catch {
    /* ignore */
  }
}

function bumpInventory(itemId: string) {
  try {
    const raw = (wx.getStorageSync(INV_KEY) || {}) as Record<string, number>;
    raw[itemId] = (raw[itemId] || 0) + 1;
    wx.setStorageSync(INV_KEY, raw);
  } catch {
    /* ignore */
  }
}

function localList(tab: ShopTab): ShopListResult {
  const safeTab = (SHOP_TABS as readonly string[]).includes(tab) ? tab : 'all';
  const local = readLocal();
  const bought = new Set(local.boughtIds);
  const filtered =
    safeTab === 'all'
      ? SEED_CATALOG
      : SEED_CATALOG.filter((i) => i.shopCategory === safeTab);
  const pageSize = GAME.SHOP_PAGE_SIZE;
  const total = filtered.length;
  const items = filtered.map((i) => ({
    ...i,
    boughtToday: bought.has(i.id),
  }));
  return {
    stars: getStars(),
    tab: safeTab as ShopTab,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    dayKey: local.dayKey,
    items,
  };
}

function localPurchase(itemId: string): ShopPurchaseResult {
  const item = SEED_CATALOG.find((i) => i.id === itemId);
  if (!item) {
    const err = new Error('物品不存在') as Error & { code?: string };
    err.code = 'NOT_FOUND';
    throw err;
  }
  const local = readLocal();
  if (local.boughtIds.includes(itemId)) {
    const err = new Error('今日已购买该商品') as Error & { code?: string };
    err.code = 'DAILY_LIMIT';
    throw err;
  }
  const stars = getStars();
  if (stars < item.price) {
    const err = new Error('星星不足') as Error & { code?: string };
    err.code = 'INSUFFICIENT_STARS';
    throw err;
  }
  const nextStars = stars - item.price;
  setStars(nextStars);
  local.boughtIds.push(itemId);
  writeLocal(local);
  bumpInventory(itemId);
  emit(GameEvent.INVENTORY_CHANGED, { itemId, delta: 1 });
  return {
    itemId,
    price: item.price,
    stars: nextStars,
    dayKey: local.dayKey,
  };
}

export async function listShop(tab: ShopTab = 'all'): Promise<ShopListResult> {
  try {
    const res = await call<ShopListResult>('shop', {
      action: 'list',
      tab,
    });
    if (res && Array.isArray(res.items)) {
      if (typeof res.stars === 'number') setStars(res.stars);
      if (res.items.length) return res;
    }
    /** 云端货架为空时用本地种子，方便无后台配置时联调 */
    return localList(tab);
  } catch {
    return localList(tab);
  }
}

export async function purchaseShop(itemId: string): Promise<ShopPurchaseResult> {
  const requestId = makeRequestId();
  try {
    const res = await call<ShopPurchaseResult>('shop', {
      action: 'purchase',
      itemId,
      requestId,
    });
    if (typeof res.stars === 'number') setStars(res.stars);
    emit(GameEvent.INVENTORY_CHANGED, { itemId, delta: 1 });
    return res;
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (
      code === 'DAILY_LIMIT' ||
      code === 'INSUFFICIENT_STARS' ||
      code === 'NOT_FOUND' ||
      code === 'VALIDATION'
    ) {
      throw e;
    }
    return localPurchase(itemId);
  }
}

export async function shopTalk(): Promise<string> {
  try {
    const res = await call<{ text: string }>('shop', { action: 'talk' });
    if (res?.text) return res.text;
  } catch {
    /* local */
  }
  return DEFAULT_LINES[Math.floor(Math.random() * DEFAULT_LINES.length)];
}

export function canBuyItem(
  item: ShopItemView | null,
  stars: number,
): boolean {
  if (!item) return false;
  if (item.boughtToday) return false;
  return stars >= item.price;
}
