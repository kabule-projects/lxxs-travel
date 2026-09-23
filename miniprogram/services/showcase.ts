import GAME from '../utils/constants';
import { call } from './api';
import { resolveDynamicAssetList } from '../utils/resolve-dynamic-asset';
import { preloadImages } from '../utils/preload';

export interface ShowcaseItemView {
  id: string;
  itemId: string;
  name: string;
  icon: string;
  description: string;
  obtainedAt: number;
}

export interface ShowcaseListResult {
  pageSize: number;
  total: number;
  totalPages: number;
  items: ShowcaseItemView[];
}

function normalizeList(res: ShowcaseListResult): ShowcaseListResult {
  return {
    pageSize: res.pageSize || GAME.SHOWCASE_PAGE_SIZE,
    total: res.total ?? res.items.length,
    totalPages:
      res.totalPages ||
      Math.max(1, Math.ceil(res.items.length / GAME.SHOWCASE_PAGE_SIZE)),
    items: res.items,
  };
}

/** 会话内缓存：loading 阶段预取，展示柜页先吃缓存秒开再后台刷新 */
let cache: ShowcaseListResult | null = null;

async function fetchCloud(): Promise<ShowcaseListResult> {
  const res = await call<ShowcaseListResult>('showcase', { action: 'list' });
  if (!res || !Array.isArray(res.items)) {
    throw new Error('展示柜响应异常');
  }
  const items = (await resolveDynamicAssetList(res.items, ['icon'])) as ShowcaseItemView[];
  cache = normalizeList({ ...res, items });
  return cache;
}

/** loading 阶段预取展示柜数据并预热物品图；失败不抛错（展示柜页自行回落） */
export async function prefetchShowcase(): Promise<void> {
  try {
    const res = await fetchCloud();
    void preloadImages(
      res.items.map((i) => i.icon).filter(Boolean),
      10000,
    );
  } catch {
    /* 展示柜页打开时会自己拉 */
  }
}

/** 有缓存先吃缓存秒开；force=true 强制走云端拉新。云端连不上且无缓存时直接抛错 */
export async function listShowcase(force = false): Promise<ShowcaseListResult> {
  if (!force && cache) return cache;
  try {
    return await fetchCloud();
  } catch (e) {
    if (cache) return cache;
    throw e;
  }
}

