import GAME from '../utils/constants';
import { call } from './api';
import {
  makeId,
  randomPilePos,
  randomSkyPos,
  rollInterval,
  rollRice,
  withRemain,
  type RoofStarView,
} from '../utils/roof-logic';

const STORAGE_KEY = 'lxxs_roof_local';

export interface RoofSyncResult {
  stars: number;
  riceStars: number;
  nextSpawnAt: number;
  pending: RoofStarView[];
  dropped: RoofStarView[];
}

interface LocalState {
  stars: number;
  riceStars: number;
  nextSpawnAt: number;
  pending: Array<Omit<RoofStarView, 'remainText'>>;
  dropped: Array<Omit<RoofStarView, 'remainText'>>;
}

function readLocal(): LocalState {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY) as LocalState | '';
    if (raw && typeof raw === 'object' && Array.isArray(raw.pending)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  const now = Date.now();
  return {
    stars: 0,
    riceStars: 0,
    nextSpawnAt: now,
    pending: [],
    dropped: [],
  };
}

function writeLocal(state: LocalState) {
  try {
    wx.setStorageSync(STORAGE_KEY, state);
  } catch {
    /* ignore */
  }
}

function hydrate(state: LocalState, now: number): RoofSyncResult {
  return {
    stars: state.stars,
    riceStars: state.riceStars,
    nextSpawnAt: state.nextSpawnAt,
    pending: state.pending.map((s) => withRemain(s, now)),
    dropped: state.dropped.map((s) => withRemain(s, now)),
  };
}

function localSync(walletStars: number, walletRice: number): RoofSyncResult {
  const now = Date.now();
  const state = readLocal();
  state.stars = walletStars;
  state.riceStars = walletRice;

  const nextPending = [];
  for (const star of state.pending) {
    if (star.dropAt <= now && state.dropped.length < GAME.STAR_DROPPED_CAP) {
      const pile = randomPilePos(state.dropped.length);
      state.dropped.push({ ...star, status: 'dropped', ...pile });
    } else {
      nextPending.push(star);
    }
  }
  state.pending = nextPending;

  let guard = 0;
  while (now >= state.nextSpawnAt && state.pending.length < GAME.STAR_PENDING_CAP && guard < 8) {
    guard += 1;
    const sky = randomSkyPos(state.pending.length);
    state.pending.push({
      id: makeId(),
      type: rollRice() ? 'rice' : 'normal',
      status: 'pending',
      ...sky,
      x: 0,
      y: 0,
      rotate: 0,
      spawnAt: now,
      dropAt: now + rollInterval(),
    });
    state.nextSpawnAt = now + rollInterval();
  }
  if (state.pending.length >= GAME.STAR_PENDING_CAP && now >= state.nextSpawnAt) {
    state.nextSpawnAt = now + rollInterval();
  }

  writeLocal(state);
  return hydrate(state, now);
}

function localCollect(starId: string): { id: string; type: RoofStarView['type']; stars: number; riceStars: number } | null {
  const state = readLocal();
  const idx = state.dropped.findIndex((s) => s.id === starId);
  if (idx < 0) return null;
  const star = state.dropped[idx];
  state.dropped.splice(idx, 1);
  if (star.type === 'rice') state.riceStars += 1;
  else state.stars += 1;
  writeLocal(state);
  return { id: starId, type: star.type, stars: state.stars, riceStars: state.riceStars };
}

export async function syncRoof(walletStars: number, walletRice: number): Promise<RoofSyncResult> {
  try {
    return await call<RoofSyncResult>('roof', { action: 'sync' });
  } catch {
    return localSync(walletStars, walletRice);
  }
}

export async function collectRoofStar(starId: string): Promise<{
  id: string;
  type: RoofStarView['type'];
  stars: number;
  riceStars: number;
}> {
  try {
    return await call('roof', { action: 'collect', starId });
  } catch {
    const local = localCollect(starId);
    if (!local) throw new Error('星星不可收取');
    return local;
  }
}
