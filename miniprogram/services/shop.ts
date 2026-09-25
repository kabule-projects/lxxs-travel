import { call } from './api';
import { setStars } from '../store/user';
import { emit, GameEvent } from '../utils/event-bus';
import { resolveDynamicAsset } from '../utils/resolve-dynamic-asset';
import { preloadImages } from '../utils/preload';

export interface ShopItemView {
  id: string;
  icon: string;
  price: number;
  name: string;
  description: string;
  shopCategory: string;
  boughtToday: boolean;
}

export interface ShopListResult {
  stars: number;
  tab: string;
  pageSize: number;
  total: number;
  totalPages: number;
  dayKey: string;
  /** 全部在售商品（仅食物）；前端按 pageSize 分页 */
  items: ShopItemView[];
}

export interface ShopPurchaseResult {
  itemId: string;
  price: number;
  stars: number;
  dayKey: string;
}

const INV_KEY = 'lxxs_inventory_local';

const DEFAULT_LINES = [
  '今天也要好好挑选行李呀～',
  '这件很适合深深出门用！',
  '星星攒够了再来买也不迟哦。',
  '欢迎光临 coconono！',
  '买了记得放进背包再出发。',
];

function makeRequestId(): string {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

/** 会话内缓存：loading 阶段预取，进商店纯读缓存秒开；购买后本地补 boughtToday */
let cache: ShopListResult | null = null;

async function fetchCloud(): Promise<ShopListResult> {
  const res = await call<ShopListResult>('shop', { action: 'list' });
  if (!res || !Array.isArray(res.items) || !res.items.length) {
    throw new Error('商店响应异常');
  }
  if (typeof res.stars === 'number') setStars(res.stars);
  res.items = await Promise.all(
    res.items.map(async (i) => ({ ...i, icon: await resolveDynamicAsset(i.icon) })),
  );
  cache = res;
  return res;
}

/** loading 阶段预取货架数据并预热商品图；失败不抛错（商店页打开时会自己拉并报错） */
export async function prefetchShop(): Promise<void> {
  try {
    const res = await fetchCloud();
    void preloadImages(
      res.items.map((i) => i.icon).filter(Boolean),
      10000,
    );
  } catch {
    /* 商店页打开时会自己拉 */
  }
}

/** 有缓存先吃缓存秒开；force=true 强制走云端拉新。云端连不上且无缓存时直接抛错 */
export async function listShop(force = false): Promise<ShopListResult> {
  if (!force && cache) return cache;
  try {
    return await fetchCloud();
  } catch (e) {
    if (cache) return cache;
    throw e;
  }
}

/** 购买成功后把最新余额同步进缓存（每日限购已解除，不再标记 boughtToday，可继续购买） */
function markBoughtInCache(stars: number) {
  if (!cache) return;
  cache = { ...cache, stars };
}

export async function purchaseShop(itemId: string): Promise<ShopPurchaseResult> {
  const requestId = makeRequestId();
  const res = await call<ShopPurchaseResult>('shop', {
    action: 'purchase',
    itemId,
    requestId,
  });
  if (typeof res.stars === 'number') setStars(res.stars);
  markBoughtInCache(res.stars);
  bumpInventory(itemId);
  emit(GameEvent.INVENTORY_CHANGED, { itemId, delta: 1 });
  return res;
}

export async function shopTalk(): Promise<string> {
  try {
    const res = await call<{ text: string }>('shop', { action: 'talk' });
    if (res?.text) return res.text;
  } catch {
    /* 文案兜底，不涉及数据 */
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
