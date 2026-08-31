import GAME from '../utils/constants';
import { call } from './api';
import { ITEM_CATALOG, listOwned } from './inventory';

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

  /** 再补几条纯展示占位，方便看满页滑动 */
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

  /** 目录里再取未持有的几件填满至少 2 页联调 */
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

export async function listShowcase(): Promise<ShowcaseListResult> {
  try {
    const res = await call<ShowcaseListResult>('showcase', { action: 'list' });
    if (res && Array.isArray(res.items) && res.items.length) {
      return {
        pageSize: res.pageSize || GAME.SHOWCASE_PAGE_SIZE,
        total: res.total ?? res.items.length,
        totalPages:
          res.totalPages ||
          Math.max(1, Math.ceil(res.items.length / GAME.SHOWCASE_PAGE_SIZE)),
        items: res.items,
      };
    }
    return localList();
  } catch {
    return localList();
  }
}
