import { call } from './api';
import GAME from '../utils/constants';
import { normalizeTitle } from './diary';
import { resolveDynamicAssetList } from '../utils/resolve-dynamic-asset';

export type PigeonState = 'away' | 'mail' | 'idle';

export type PostcardType = 'postcard' | 'letter' | 'photo' | 'special';

export interface MailItem {
  tripId: string;
  instanceId: string;
  postcardId: string;
  type: PostcardType;
  title: string;
  rarity: string;
  imageThumb: string;
  imageFull: string;
  story: string;
  deliverAt: number;
  isNew: boolean;
}

export interface MailboxSyncResult {
  items: MailItem[];
  unreadCount: number;
  pigeonState: PigeonState;
  traveling: boolean;
  /** 本次行程是否已送回过信（含已收）：旅行中鸽子中途回家则常驻 */
  hasDelivered?: boolean;
  lastMailboxOpenAt: number;
  mailCap: number;
}

/** 本地回退保留用：按投递时间倒序 */
function sortMailItemsDesc(items: MailItem[]): MailItem[] {
  return [...items].sort((a, b) => b.deliverAt - a.deliverAt);
}

/** 云端连不上直接抛错，由页面提示用户（不再回落本地信箱缓存） */
export async function syncMailbox(): Promise<MailboxSyncResult> {
  const res = await call<MailboxSyncResult>('postcard', { action: 'mailbox' });
  const resolved = (await resolveDynamicAssetList(sortMailItemsDesc(res.items || []), [
    'imageThumb',
    'imageFull',
  ])) as MailItem[];
  const items = resolved.map((i) => ({ ...i, title: normalizeTitle(i.title) }));
  return {
    ...res,
    items,
    pigeonState: res.pigeonState || 'idle',
    mailCap: res.mailCap || GAME.PIGEON_MAIL_CAP,
  };
}

export async function openMailbox(): Promise<MailboxSyncResult> {
  const res = await call<MailboxSyncResult>('postcard', { action: 'openMailbox' });
  const resolved = (await resolveDynamicAssetList(sortMailItemsDesc(res.items || []), [
    'imageThumb',
    'imageFull',
  ])) as MailItem[];
  const items = resolved.map((i) => ({ ...i, title: normalizeTitle(i.title) }));
  return {
    ...res,
    items,
    pigeonState: res.pigeonState || 'idle',
    mailCap: res.mailCap || GAME.PIGEON_MAIL_CAP,
  };
}

/** 标记已读失败不阻断开信，调用方自行忽略 */
export async function markMailSeen(tripId: string, instanceId: string) {
  await call('postcard', { action: 'markSeen', tripId, instanceId });
}

export async function claimMail(tripId: string, instanceId: string) {
  const res = await call<{
    postcardId: string;
    type?: PostcardType;
    title: string;
    rarity: string;
    imageFull?: string;
    imageThumb?: string;
    story?: string;
    firstUnlock: boolean;
  }>('postcard', { action: 'claim', tripId, instanceId });
  return res;
}
