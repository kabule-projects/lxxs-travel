import GAME from '../utils/constants';
import { call } from './api';
import { getStars, setStars } from '../store/user';

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

const SEED_POOL: Omit<GachaCatalogItem, 'obtained'>[] = [
  { gachaId: 'gacha_potato', name: '烤土豆', icon: '', rarity: 'N' },
  { gachaId: 'gacha_rice_bowl', name: '米饭碗', icon: '', rarity: 'N' },
  { gachaId: 'gacha_porridge', name: '葱花粥', icon: '', rarity: 'R' },
  { gachaId: 'gacha_chocolate', name: '巧克力', icon: '', rarity: 'R' },
  { gachaId: 'gacha_mushroom_soup', name: '菌菇杯', icon: '', rarity: 'R' },
  { gachaId: 'gacha_cake', name: '草莓蛋糕', icon: '', rarity: 'SR' },
  { gachaId: 'gacha_mic', name: '麦克风', icon: '', rarity: 'SR' },
  { gachaId: 'gacha_camera', name: '拍立得', icon: '', rarity: 'SSR' },
  { gachaId: 'gacha_umbrella', name: '星星伞', icon: '', rarity: 'SSR' },
  { gachaId: 'gacha_crown', name: '旅行王冠', icon: '', rarity: 'UR' },
  { gachaId: 'gacha_compass', name: '幸运罗盘', icon: '', rarity: 'UR' },
  { gachaId: 'gacha_ticket', name: '神秘车票', icon: '', rarity: 'N' },
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
  for (let i = 0; i < count; i += 1) {
    const r = localDrawOne(SEED_POOL, owned, pity);
    if (r.duplicate) stars += 1;
    results.push(r);
  }
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
    return res.items || [];
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
    return res;
  } catch (e) {
    if ((e as Error & { code?: string }).code === 'INSUFFICIENT_STARS') throw e;
    return localDraw(count);
  }
}
