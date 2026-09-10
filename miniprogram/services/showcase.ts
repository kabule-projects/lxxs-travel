import GAME from '../utils/constants';
import { call } from './api';
import { ITEM_CATALOG, listOwned } from './inventory';
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

/** 无云数据时用持有物生成展柜联调数据 */
function localList(): ShowcaseListResult {
  const owned = listOwned('all');
  const fromInv = owned.map((o, i) => ({
    id: o.id,
    itemId: o.id,
    name: o.name,
    icon: o.icon,
    description: o.description,
    obtainedAt: Date.now() - (owned.length - i) * 1000,
  }));

  const extras: ShowcaseItemView[] = [
    {
      id: 'demo_potato',
      itemId: 'demo_potato',
      name: '贵阳六中门口的狼牙土豆',
      icon: '',
      description: '放学时间在贵阳六中门口小摊前\n随机刷新一名周姓学子',
      obtainedAt: 1,
    },
    {
      id: 'demo_leaf',
      itemId: 'demo_leaf',
      name: '一片会说话的叶子',
      icon: '',
      description: '叶子上写着：记得喝水。',
      obtainedAt: 2,
    },
  ];

  const seen = new Set(fromInv.map((i) => i.itemId));
  for (const e of extras) {
    if (!seen.has(e.itemId)) fromInv.push(e);
  }

  for (const c of ITEM_CATALOG) {
    if (fromInv.length >= GAME.SHOWCASE_PAGE_SIZE * 2) break;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    fromInv.push({
      id: c.id,
      itemId: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      obtainedAt: fromInv.length,
    });
  }

  const pageSize = GAME.SHOWCASE_PAGE_SIZE;
  return {
    pageSize,
    total: fromInv.length,
    totalPages: Math.max(1, Math.ceil(fromInv.length / pageSize) || 1),
    items: fromInv,
  };
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
  const items = await resolveDynamicAssetList(res.items, ['icon']);
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

/** 有缓存先吃缓存秒开；force=true 强制走云端拉新（预取/刷新用） */
export async function listShowcase(force = false): Promise<ShowcaseListResult> {
  if (!force && cache) return cache;
  try {
    return await fetchCloud();
  } catch {
    if (cache) return cache;
    return localList();
  }
}

