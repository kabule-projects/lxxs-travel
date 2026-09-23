import { call } from './api';
import type { RoofStarView } from '../utils/roof-logic';

export interface RoofSyncResult {
  stars: number;
  riceStars: number;
  nextSpawnAt: number;
  /** 未收取的教学星数量（指引中屋顶步骤完成判定） */
  guideDropped?: number;
  pending: RoofStarView[];
  dropped: RoofStarView[];
}

/** 云端同步天台星星；连不上直接抛错，由页面提示用户 */
export async function syncRoof(): Promise<RoofSyncResult> {
  return call<RoofSyncResult>('roof', { action: 'sync' });
}

export async function collectRoofStar(starId: string): Promise<{
  id: string;
  type: RoofStarView['type'];
  stars: number;
  riceStars: number;
}> {
  return call('roof', { action: 'collect', starId });
}
