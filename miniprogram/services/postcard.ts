import { call } from './api';
import GAME from '../utils/constants';

export type PigeonState = 'away' | 'mail' | 'idle';

export interface MailItem {
  tripId: string;
  instanceId: string;
  postcardId: string;
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
  lastMailboxOpenAt: number;
  mailCap: number;
}

const LOCAL_KEY = 'lxxs_mailbox_local';

interface LocalMail {
  items: MailItem[];
  lastMailboxOpenAt: number;
  traveling: boolean;
}

function readLocal(): LocalMail {
  try {
    const raw = wx.getStorageSync(LOCAL_KEY) as LocalMail | '';
    if (raw && typeof raw === 'object') return raw;
  } catch {
    /* ignore */
  }
  return { items: [], lastMailboxOpenAt: 0, traveling: false };
}

function writeLocal(state: LocalMail) {
  try {
    wx.setStorageSync(LOCAL_KEY, state);
  } catch {
    /* ignore */
  }
}

function localPigeon(state: LocalMail): PigeonState {
  if (state.traveling && state.items.length === 0) return 'away';
  if (state.items.length > 0) {
    const newest = state.items.reduce((m, i) => Math.max(m, i.deliverAt), 0);
    if (newest > (state.lastMailboxOpenAt || 0)) return 'mail';
  }
  return 'idle';
}

/** 本地回退：保留最新 CAP 封，按投递时间倒序 */
function sortMailItemsDesc(items: MailItem[]): MailItem[] {
  return [...items].sort((a, b) => b.deliverAt - a.deliverAt);
}

function trimLocal(items: MailItem[]): MailItem[] {
  return [...items]
    .sort((a, b) => b.deliverAt - a.deliverAt)
    .slice(0, GAME.PIGEON_MAIL_CAP);
}

export async function syncMailbox(): Promise<MailboxSyncResult> {
  try {
    const res = await call<MailboxSyncResult>('postcard', { action: 'mailbox' });
    writeLocal({
      items: sortMailItemsDesc(res.items || []),
      lastMailboxOpenAt: res.lastMailboxOpenAt || 0,
      traveling: !!res.traveling,
    });
    const items = sortMailItemsDesc(res.items || []);
    return {
      ...res,
      items,
      pigeonState: res.pigeonState || 'idle',
      mailCap: res.mailCap || GAME.PIGEON_MAIL_CAP,
    };
  } catch {
    const local = readLocal();
    const items = trimLocal(local.items);
    return {
      items,
      unreadCount: items.length,
      pigeonState: localPigeon({ ...local, items }),
      traveling: local.traveling,
      lastMailboxOpenAt: local.lastMailboxOpenAt,
      mailCap: GAME.PIGEON_MAIL_CAP,
    };
  }
}

export async function openMailbox(): Promise<MailboxSyncResult> {
  try {
    const res = await call<MailboxSyncResult>('postcard', { action: 'openMailbox' });
    const items = sortMailItemsDesc(res.items || []);
    writeLocal({
      items,
      lastMailboxOpenAt: res.lastMailboxOpenAt || 0,
      traveling: !!res.traveling,
    });
    return {
      ...res,
      items,
      pigeonState: res.pigeonState || 'idle',
      mailCap: res.mailCap || GAME.PIGEON_MAIL_CAP,
    };
  } catch {
    const local = readLocal();
    local.lastMailboxOpenAt = Date.now();
    writeLocal(local);
    return syncMailbox();
  }
}

export async function markMailSeen(tripId: string, instanceId: string) {
  try {
    await call('postcard', { action: 'markSeen', tripId, instanceId });
  } catch {
    const local = readLocal();
    local.items = local.items.map((i) =>
      i.instanceId === instanceId ? { ...i, isNew: false } : i,
    );
    writeLocal(local);
  }
}

export async function claimMail(tripId: string, instanceId: string) {
  const res = await call<{
    postcardId: string;
    title: string;
    rarity: string;
    imageFull?: string;
    story?: string;
    firstUnlock: boolean;
  }>('postcard', { action: 'claim', tripId, instanceId });
  try {
    const local = readLocal();
    local.items = local.items.filter((i) => i.instanceId !== instanceId);
    writeLocal(local);
  } catch {
    /* ignore */
  }
  return res;
}

/** 本地联调：模拟一封新信 */
export function debugPushLocalMail(partial?: Partial<MailItem>) {
  const local = readLocal();
  const now = Date.now();
  local.items = trimLocal([
    ...local.items,
    {
      tripId: 'local',
      instanceId: `local_${now}`,
      postcardId: 'pc_debug',
      title: partial?.title || '明信片的名字',
      rarity: 'N',
      imageThumb: '',
      imageFull: '',
      story: '这是一封测试信件。',
      deliverAt: now,
      isNew: true,
      ...partial,
    },
  ]);
  writeLocal(local);
}

export function setLocalTraveling(traveling: boolean) {
  const local = readLocal();
  local.traveling = traveling;
  writeLocal(local);
}
