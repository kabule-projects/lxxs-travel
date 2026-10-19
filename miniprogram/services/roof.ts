import { call } from './api';
import type { RoofStarView } from '../utils/roof-logic';
import type { TripSyncResult } from './trip';
import { normalizeMailboxRes, type MailboxSyncResult } from './postcard';

export interface RoofSyncResult {
  stars: number;
  riceStars: number;
  nextSpawnAt: number;
  /** 未收取的教学星数量（指引中屋顶步骤完成判定） */
  guideDropped?: number;
  pending: RoofStarView[];
  dropped: RoofStarView[];
}

/** 云端同步天台星星；连不上直接抛错，由页面提示用户。
 *  restartGuide：仅冷启动重开教程时传 true，服务端据此清零教学经济并重新播种 */
export async function syncRoof(options?: {
  restartGuide?: boolean;
}): Promise<RoofSyncResult> {
  return call<RoofSyncResult>('roof', {
    action: 'sync',
    restartGuide: !!options?.restartGuide,
  });
}

export async function collectRoofStar(starId: string): Promise<{
  id: string;
  type: RoofStarView['type'];
  stars: number;
  riceStars: number;
}> {
  return call('roof', { action: 'collect', starId });
}

/** 一键收取所有已落地的星星（新手指引期间前端不展示入口） */
export async function collectAllRoofStars(): Promise<{
  collected: number;
  normal: number;
  rice: number;
  stars: number;
  riceStars: number;
}> {
  return call('roof', { action: 'collectAll' });
}

/** roof.syncAll 批量回同步：一次 callFunction 拿回 行程+信箱 两段（旅行中兜底轮询用），
 *  与 trip.sync / postcard.mailbox 输出同结构；星星段轮询不消费，仍走 syncRoof */
export interface RoofAllResult {
  trip: TripSyncResult;
  mailbox: MailboxSyncResult;
}

export async function syncRoofAll(): Promise<RoofAllResult> {
  const res = await call<{ trip: TripSyncResult; mailbox: MailboxSyncResult }>('roof', {
    action: 'syncAll',
  });
  return {
    trip: res.trip,
    mailbox: await normalizeMailboxRes(res.mailbox),
  };
}
