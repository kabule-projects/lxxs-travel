import GAME from '../utils/constants';
import { call } from './api';
import { getStars, setStars } from '../store/user';
import { readInventoryCounts, writeInventoryCounts } from './inventory';
import { resolveDynamicAsset } from '../utils/resolve-dynamic-asset';

export interface GachaCatalogItem {
  gachaId: string;
  name: string;
  icon: string;
  rarity: string;
  obtained: boolean;
}

export interface GachaDrawItem {
  gachaId: string;
  name: string;
  icon: string;
  rarity: string;
  duplicate: boolean;
}

export interface GachaDrawResult {
  count: number;
  cost: number;
  stars: number;
  results: GachaDrawItem[];
  pitySR: number;
  pitySSR: number;
  pityUR: number;
}

const LOCAL_POOL_KEY = 'lxxs_gacha_pool';
const LOCAL_OWNED_KEY = 'lxxs_gacha_owned';
const LOCAL_PITY_KEY = 'lxxs_gacha_pity';

/** 本地联调兜底：与云端 gacha_pool 对齐，只出道具（items 库 accessory/equipment） */
const SEED_POOL: Omit<GachaCatalogItem, 'obtained'>[] = [
  { gachaId: 'acc_scarf', name: '小围巾', icon: '', rarity: 'N' },
  { gachaId: 'eq_map', name: '旧地图', icon: '', rarity: 'N' },
  { gachaId: 'acc_hat', name: '旅行帽', icon: '', rarity: 'R' },
  { gachaId: 'acc_badge', name: '纪念徽章', icon: '', rarity: 'R' },
  { gachaId: 'acc_glasses', name: '圆框眼镜', icon: '', rarity: 'SR' },
  { gachaId: 'eq_cam', name: '拍立得', icon: '', rarity: 'SR' },
  { gachaId: 'eq_compass', name: '小指南针', icon: '', rarity: 'SSR' },
];

const WEIGHTS: Record<string, number> = {
  N: 110,
  R: 80,
  SR: 35,
  SSR: 11,
  UR: 3,
};

function readOwned(): Set<string> {
  try {
    const raw = wx.getStorageSync(LOCAL_OWNED_KEY) as string[] | '';
    if (Array.isArray(raw)) return new Set(raw);
  } catch {
    /* ignore */
  }
  return new Set();
}

function writeOwned(set: Set<string>) {
  try {
    wx.setStorageSync(LOCAL_OWNED_KEY, [...set]);
  } catch {
    /* ignore */
  }
}

function readPity() {
  try {
    const raw = wx.getStorageSync(LOCAL_PITY_KEY) as {
      pitySR?: number;
      pitySSR?: number;
      pityUR?: number;
    } | '';
    if (raw && typeof raw === 'object') return raw;
  } catch {
    /* ignore */
  }
  return { pitySR: 0, pitySSR: 0, pityUR: 0 };
}

function writePity(pity: { pitySR: number; pitySSR: number; pityUR: number }) {
  try {
    wx.setStorageSync(LOCAL_PITY_KEY, pity);
  } catch {
    /* ignore */
  }
}

function rankOf(r: string) {
  const map: Record<string, number> = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
  return map[r] || 1;
}

function localDrawOne(
  pool: typeof SEED_POOL,
  owned: Set<string>,
  pity: { pitySR: number; pitySSR: number; pityUR: number },
) {
  pity.pitySR += 1;
  pity.pitySSR += 1;
  pity.pityUR += 1;

  let min = 'N';
  if (pity.pityUR >= GAME.PITY_UR) min = 'UR';
  else if (pity.pitySSR >= GAME.PITY_SSR) min = 'SSR';
  else if (pity.pitySR >= GAME.PITY_SR) min = 'SR';

  const minRank = rankOf(min);
  let eligible = pool.filter((p) => rankOf(p.rarity) >= minRank);
  if (!eligible.length) eligible = [...pool];
  const total = eligible.reduce((s, p) => s + (WEIGHTS[p.rarity] || 10), 0);
  let roll = Math.random() * total;
  let picked = eligible[0];
  for (const p of eligible) {
    roll -= WEIGHTS[p.rarity] || 10;
    if (roll <= 0) {
      picked = p;
      break;
    }
  }

  if (rankOf(picked.rarity) >= rankOf('SR')) pity.pitySR = 0;
  if (rankOf(picked.rarity) >= rankOf('SSR')) pity.pitySSR = 0;
  if (picked.rarity === 'UR') pity.pityUR = 0;

  const duplicate = owned.has(picked.gachaId);
  if (!duplicate) owned.add(picked.gachaId);

  return {
    gachaId: picked.gachaId,
    name: picked.name,
    icon: picked.icon,
    rarity: picked.rarity,
    duplicate,
  };
}

function localDraw(count: 1 | 5): GachaDrawResult {
  const owned = readOwned();
  const pity = readPity();
  const results: GachaDrawItem[] = [];
  let stars = getStars();
  const cost = GAME.GACHA_COST * count;
  if (stars < cost) {
    const err = new Error(count > 1 ? '星星不足，无法五连' : '星星不足') as Error & {
      code?: string;
    };
    err.code = 'INSUFFICIENT_STARS';
    throw err;
  }
  stars -= cost;
  const inv = readInventoryCounts();
  for (let i = 0; i < count; i += 1) {
    const r = localDrawOne(SEED_POOL, owned, pity);
    if (r.duplicate) stars += 1;
    else inv[r.gachaId] = (inv[r.gachaId] || 0) + 1; // 扭蛋产出入背包（本地兜底）
    results.push(r);
  }
  writeInventoryCounts(inv);
  setStars(stars);
  writeOwned(owned);
  writePity({
    pitySR: pity.pitySR,
    pitySSR: pity.pitySSR,
    pityUR: pity.pityUR,
  });
  return {
    count,
    cost,
    stars,
    results,
    pitySR: pity.pitySR,
    pitySSR: pity.pitySSR,
    pityUR: pity.pityUR,
  };
}

export function gachaCost(count: 1 | 5): number {
  return GAME.GACHA_COST * count;
}

export async function listGachaCatalog(): Promise<GachaCatalogItem[]> {
  try {
    const res = await call<{ items: GachaCatalogItem[] }>('gacha', {
      action: 'catalog',
    });
    // icon 是相对素材路径，需解析为本地 WebP 地址
    const items = await Promise.all(
      (res.items || []).map(async (i) => ({ ...i, icon: await resolveDynamicAsset(i.icon) })),
    );
    return items;
  } catch {
    const owned = readOwned();
    return SEED_POOL.map((p) => ({
      ...p,
      obtained: owned.has(p.gachaId),
    }));
  }
}

export async function drawGacha(count: 1 | 5): Promise<GachaDrawResult> {
  const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  try {
    const res = await call<GachaDrawResult>('gacha', {
      action: 'draw',
      count,
      requestId,
    });
    setStars(res.stars);
    // 中奖道具 icon 同样是相对素材路径
    res.results = await Promise.all(
      (res.results || []).map(async (i) => ({ ...i, icon: await resolveDynamicAsset(i.icon) })),
    );
    return res;
  } catch (e) {
    if ((e as Error & { code?: string }).code === 'INSUFFICIENT_STARS') throw e;
    return localDraw(count);
  }
}
