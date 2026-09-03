import GAME from './constants';

export type IdlePose = (typeof GAME.IDLE_POSES)[number];

/**
 * 宅家姿势随机：等权抽取四档之一。
 * 传入 lastPose 时避免连续两次同一位置。
 */
export function pickIdlePose(lastPose?: IdlePose | null): IdlePose {
  const all = GAME.IDLE_POSES as readonly IdlePose[];
  const pool = lastPose ? all.filter((p) => p !== lastPose) : [...all];
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ?? all[0];
}

export function isIdlePose(value: string): value is IdlePose {
  return (GAME.IDLE_POSES as readonly string[]).includes(value);
}
