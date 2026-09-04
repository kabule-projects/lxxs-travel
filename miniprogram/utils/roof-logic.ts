import GAME from './constants';

export type RoofStarType = 'normal' | 'rice';
export type RoofStarStatus = 'pending' | 'dropped' | 'collected';

export interface RoofStarView {
  id: string;
  type: RoofStarType;
  status: RoofStarStatus;
  skyX: number;
  skyY: number;
  x: number;
  y: number;
  rotate: number;
  spawnAt: number;
  dropAt: number;
  remainText: string;
}

export function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 夜空中间区域随机刷新（百分比相对整屏） */
export function randomSkyPos(index: number): { skyX: number; skyY: number } {
  const cols = [34, 44, 54, 64];
  const rows = [24, 32, 40, 48];
  const col = cols[index % cols.length];
  const row = rows[Math.floor(index / cols.length) % rows.length];
  return {
    skyX: col + Math.random() * 10 - 5,
    skyY: row + Math.random() * 8 - 4,
  };
}

/** 落下后堆在鸽子左下角（百分比相对整屏；鸽子位 right:5%/bottom:24%） */
export function randomPilePos(index = 0): { x: number; y: number; rotate: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 64 + col * 4 + Math.random() * 3 - 1.5,
    y: 73 + row * 1.6 + Math.random() * 2 - 1,
    rotate: Math.floor(Math.random() * 41) - 20,
  };
}

export function formatRemain(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function withRemain(star: Omit<RoofStarView, 'remainText'>, now: number): RoofStarView {
  return {
    ...star,
    remainText: formatRemain(star.dropAt - now),
  };
}

/** 空中 pending + 地上 dropped 合并为单一列表，避免同一颗星星重复渲染 */
export interface RoofStarDisplay extends RoofStarView {
  displayLeft: number;
  displayTop: number;
}

export function mergeRoofStars(
  pending: RoofStarView[],
  dropped: RoofStarView[],
): RoofStarDisplay[] {
  const sky = pending.map((s) => ({
    ...s,
    displayLeft: s.skyX,
    displayTop: s.skyY,
  }));
  const ground = dropped.map((s) => ({
    ...s,
    displayLeft: s.x,
    displayTop: s.y,
  }));
  return [...sky, ...ground];
}

export function rollRice(): boolean {
  return Math.random() < GAME.RICE_STAR_RATE;
}

export function rollInterval(): number {
  return randomBetween(GAME.STAR_INTERVAL_MIN_MS, GAME.STAR_INTERVAL_MAX_MS);
}

export function makeId(): string {
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
