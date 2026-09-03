import { call } from './api';
import { setRiceStars, setStars } from '../store/user';

export type InvCategory = 'food' | 'prop';

export interface InvItemView {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: InvCategory;
  type: string;
  count: number;
}

const INV_KEY = 'lxxs_inventory_local';

/** 与商店种子对齐，便于无后台时联调 */
export const ITEM_CATALOG: Array<Omit<InvItemView, 'count'>> = [
  {
    id: 'food_bento_a',
    name: '普通便当',
    description: '简单的家常便当，出行必带。',
    icon: '',
    category: 'food',
    type: 'food',
  },
  {
    id: 'food_bento_b',
    name: '豪华便当',
    description: '丰盛一些，旅途更安心。',
    icon: '',
    category: 'food',
    type: 'food',
  },
  {
    id: 'food_snack',
    name: '路上零食',
    description: '饿了就啃一口。',
    icon: '',
    category: 'food',
    type: 'food',
  },
  {
    id: 'food_tea',
    name: '保温壶茶',
    description: '路上喝一口暖暖的。',
    icon: '',
    category: 'food',
    type: 'food',
  },
  {
    id: 'acc_scarf',
    name: '小围巾',
    description: '暖暖的，适合微凉天气。',
    icon: '',
    category: 'prop',
    type: 'accessory',
  },
  {
    id: 'acc_hat',
    name: '旅行帽',
    description: '遮阳又好看。',
    icon: '',
    category: 'prop',
    type: 'accessory',
  },
  {
    id: 'acc_badge',
    name: '纪念徽章',
    description: '别在衣服上更有精神。',
    icon: '',
    category: 'prop',
    type: 'accessory',
  },
  {
    id: 'acc_glasses',
    name: '圆框眼镜',
    description: '看起来更机灵一点。',
    icon: '',
    category: 'prop',
    type: 'accessory',
  },
  {
    id: 'eq_map',
    name: '旧地图',
    description: '好像能走到更远的地方。',
    icon: '',
    category: 'prop',
    type: 'equipment',
  },
  {
    id: 'eq_cam',
    name: '拍立得',
    description: '旅途风景更容易留下。',
    icon: '',
    category: 'prop',
    type: 'equipment',
  },
  {
    id: 'eq_bag',
    name: '轻便背包',
    description: '多装一点也不累。',
    icon: '',
    category: 'prop',
    type: 'equipment',
  },
  {
    id: 'eq_compass',
    name: '小指南针',
    description: '迷路时派得上用场。',
    icon: '',
    category: 'prop',
    type: 'equipment',
  },
];

export function readInventoryCounts(): Record<string, number> {
  try {
    const raw = wx.getStorageSync(INV_KEY) as Record<string, number> | '';
    if (raw && typeof raw === 'object') return { ...raw };
  } catch {
    /* ignore */
  }
  return {};
}

export function writeInventoryCounts(map: Record<string, number>) {
  try {
    wx.setStorageSync(INV_KEY, map);
  } catch {
    /* ignore */
  }
}

/** 开发联调：若库存全空，赠送少量种子物品 */
export function ensureDemoInventory() {
  const map = readInventoryCounts();
  const hasAny = Object.values(map).some((n) => n > 0);
  if (hasAny) return;
  map.food_bento_a = 2;
  map.food_bento_b = 1;
  map.acc_scarf = 1;
  map.eq_map = 1;
  writeInventoryCounts(map);
}

export function listOwned(category?: InvCategory | 'all'): InvItemView[] {
  ensureDemoInventory();
  const counts = readInventoryCounts();
  return ITEM_CATALOG.filter((item) => {
    const n = counts[item.id] || 0;
    if (n <= 0) return false;
    if (!category || category === 'all') return true;
    return item.category === category;
  }).map((item) => ({
    ...item,
    count: counts[item.id] || 0,
  }));
}

/** 优先云端库存；失败回落本地 */
export async function fetchOwned(
  category: InvCategory | 'all' = 'all',
): Promise<InvItemView[]> {
  try {
    const res = await call<{
      stars?: number;
      riceStars?: number;
      items: InvItemView[];
    }>('inventory', {
      action: 'list',
      category,
    });
    if (typeof res.stars === 'number') setStars(res.stars);
    if (typeof res.riceStars === 'number') setRiceStars(res.riceStars);
    if (Array.isArray(res.items)) {
      if (res.items.length) {
        const map: Record<string, number> = {};
        res.items.forEach((i) => {
          map[i.id] = i.count;
        });
        writeInventoryCounts(map);
      }
      return res.items.map((i) => ({
        ...i,
        category:
          i.category ||
          (i.type === 'food' ? 'food' : ('prop' as InvCategory)),
      }));
    }
  } catch {
    /* local */
  }
  return listOwned(category);
}

export function getItemMeta(id: string) {
  return ITEM_CATALOG.find((i) => i.id === id) || null;
}

export function consumeItems(ids: string[]): boolean {
  const map = readInventoryCounts();
  for (const id of ids) {
    if (!id) continue;
    if ((map[id] || 0) < 1) return false;
  }
  for (const id of ids) {
    if (!id) continue;
    map[id] = (map[id] || 0) - 1;
    if (map[id] <= 0) delete map[id];
  }
  writeInventoryCounts(map);
  return true;
}
