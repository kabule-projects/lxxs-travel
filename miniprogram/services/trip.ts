import { call } from './api';
import { consumeItems } from './inventory';
import {
  getRiceStars,
  getProfile,
  patchProfile,
  setRiceStars,
} from '../store/user';
import { emit, GameEvent } from '../utils/event-bus';
import GAME from '../utils/constants';
import { pushLocalDeliveredMail, type MailItem } from './postcard';

export interface TripLoadout {
  bento: string;
  riceStar?: boolean;
  props?: string[];
}

export interface TripStartResult {
  tripId: string;
  destId: string;
  destName: string;
  startAt: number;
  endAt: number;
  usedRiceStar: boolean;
}

const TRIP_KEY = 'lxxs_trip_local';

interface LocalTripPostcard {
  instanceId: string;
  postcardId: string;
  type: MailItem['type'];
  status: 'pending' | 'delivered' | 'claimed';
  deliverAt: number;
  title: string;
  rarity: string;
  imageThumb: string;
  imageFull: string;
  story: string;
  isNew: boolean;
}

function makeLocalPostcards(
  tripId: string,
  startAt: number,
  endAt: number,
  destName: string,
): LocalTripPostcard[] {
  const duration = Math.max(1, endAt - startAt);
  const deliverAt = startAt + Math.floor(duration * 0.4);
  return [
    {
      instanceId: `local_pm_${startAt}`,
      postcardId: 'pc_local_park',
      type: 'letter',
      status: 'pending',
      deliverAt,
      title: destName || '旅途明信片',
      rarity: 'N',
      imageThumb: '',
      imageFull: '',
      story: '今天天气很好，风轻轻吹过树叶。\n——旅行小深',
      isNew: true,
    },
  ];
}

function advanceLocalPostcards(
  tripId: string,
  postcards: LocalTripPostcard[],
): { postcards: LocalTripPostcard[]; delivered: MailItem[] } {
  const now = Date.now();
  const delivered: MailItem[] = [];
  const next = postcards.map((p) => {
    if (p.status !== 'pending' || p.deliverAt > now) return p;
    const mail: MailItem = {
      tripId,
      instanceId: p.instanceId,
      postcardId: p.postcardId,
      type: p.type,
      title: p.title,
      rarity: p.rarity,
      imageThumb: p.imageThumb,
      imageFull: p.imageFull,
      story: p.story,
      deliverAt: p.deliverAt,
      isNew: true,
    };
    delivered.push(mail);
    pushLocalDeliveredMail(mail);
    return { ...p, status: 'delivered' as const };
  });
  return { postcards: next, delivered };
}

function localStart(loadout: TripLoadout): TripStartResult {
  const profile = getProfile();
  if (profile?.currentTripId) {
    const err = new Error('深深正在旅行中') as Error & { code?: string };
    err.code = 'ALREADY_TRAVELING';
    throw err;
  }
  if (!loadout.bento) {
    const err = new Error('需要准备食物') as Error & { code?: string };
    err.code = 'NEED_FOOD';
    throw err;
  }
  if (loadout.riceStar && getRiceStars() < 1) {
    const err = new Error('没有米字星') as Error & { code?: string };
    err.code = 'NO_RICE_STAR';
    throw err;
  }

  const propIds = (loadout.props || []).filter(Boolean).slice(0, GAME.BAG_PROP_SLOTS);
  const okConsume = consumeItems([loadout.bento, ...propIds]);
  if (!okConsume) {
    const err = new Error('物品库存不足') as Error & { code?: string };
    err.code = 'NO_STOCK';
    throw err;
  }

  const usedRice = !!loadout.riceStar;
  if (usedRice) {
    setRiceStars(Math.max(0, getRiceStars() - 1));
  }

  const startAt = Date.now();
  /** 本地联调：2–6 小时量级，缩短为 2–5 分钟便于测试 */
  const durationMs = (2 + Math.random() * 3) * 60 * 1000;
  const endAt = startAt + durationMs;
  const tripId = `local_trip_${startAt}`;
  const result: TripStartResult = {
    tripId,
    destId: 'dest_local_park',
    destName: '附近的小公园',
    startAt,
    endAt,
    usedRiceStar: usedRice,
  };

  const postcards = makeLocalPostcards(
    tripId,
    startAt,
    endAt,
    result.destName,
  );

  try {
    wx.setStorageSync(TRIP_KEY, {
      ...result,
      loadout,
      status: 'traveling',
      postcards,
    });
  } catch {
    /* ignore */
  }

  patchProfile({ currentTripId: tripId });
  emit(GameEvent.TRIP_STARTED, result);
  emit(GameEvent.INVENTORY_CHANGED, { reason: 'trip_start' });
  return result;
}

export async function startTrip(loadout: TripLoadout): Promise<TripStartResult> {
  const requestId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    const res = await call<TripStartResult>('trip', {
      action: 'start',
      loadout,
      source: 'bag',
      requestId,
    });
    const propIds = (loadout.props || []).filter(Boolean).slice(0, GAME.BAG_PROP_SLOTS);
    /** 云端已扣库存；同步本地缓存，避免背包/物品列表仍显示旧数量 */
    consumeItems([loadout.bento, ...propIds]);
    if (res.usedRiceStar) {
      setRiceStars(Math.max(0, getRiceStars() - 1));
    }
    patchProfile({ currentTripId: res.tripId });
    emit(GameEvent.TRIP_STARTED, res);
    emit(GameEvent.INVENTORY_CHANGED, { reason: 'trip_start' });
    return res;
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (
      code === 'NEED_FOOD' ||
      code === 'ALREADY_TRAVELING' ||
      code === 'NO_STOCK' ||
      code === 'NO_RICE_STAR' ||
      code === 'INVALID_FOOD' ||
      code === 'INVALID_PROP' ||
      code === 'NO_DESTINATION' ||
      code === 'NO_POSTCARD'
    ) {
      throw e;
    }
    return localStart(loadout);
  }
}

export async function fetchFarewell(): Promise<string> {
  const fallback = [
    '路上小心，记得想我～',
    '去看看外面的世界吧！',
    '带点好吃的回来哦。',
    '深深，一路顺风！',
  ];
  try {
    const res = await call<{ text: string }>('trip', { action: 'farewell' });
    if (res?.text) return res.text;
  } catch {
    /* local */
  }
  return fallback[Math.floor(Math.random() * fallback.length)];
}

export interface TripSyncResult {
  trip: {
    _id: string;
    status: string;
    destName?: string;
    endAt?: number;
    souvenirs?: string[];
  } | null;
  delivered: unknown[];
  souvenirGranted?: string | null;
}

export async function syncTrip(): Promise<TripSyncResult> {
  try {
    const res = await call<TripSyncResult>('trip', { action: 'sync' });
    if (!res.trip || res.trip.status === 'at_home') {
      patchProfile({ currentTripId: undefined });
    } else if (res.trip._id) {
      patchProfile({ currentTripId: res.trip._id });
    }
    if (res.trip?.status === 'returned') {
      emit(GameEvent.TRIP_RETURNED, res);
    }
    return res;
  } catch {
    return localSyncTrip();
  }
}

function localSyncTrip(): TripSyncResult {
  try {
    const raw = wx.getStorageSync(TRIP_KEY) as {
      tripId?: string;
      status?: string;
      endAt?: number;
      destName?: string;
      souvenirs?: string[];
      postcards?: LocalTripPostcard[];
    } | '';
    if (!raw || typeof raw !== 'object' || !raw.tripId) {
      patchProfile({ currentTripId: undefined });
      return { trip: null, delivered: [] };
    }
    const now = Date.now();
    let status = raw.status || 'traveling';
    const tripId = raw.tripId;
    let postcards = Array.isArray(raw.postcards) ? raw.postcards : [];
    if (!postcards.length && raw.endAt) {
      postcards = makeLocalPostcards(
        tripId,
        now - 60000,
        raw.endAt,
        raw.destName || '',
      );
    }
    const advanced = advanceLocalPostcards(tripId, postcards);
    postcards = advanced.postcards;
    if (advanced.delivered.length) {
      advanced.delivered.forEach(() => {
        emit(GameEvent.POSTCARD_DELIVERED);
      });
    }
    if (status === 'traveling' && raw.endAt && now >= raw.endAt) {
      status = 'returned';
    }
    wx.setStorageSync(TRIP_KEY, { ...raw, status, postcards });
    const trip = {
      _id: tripId,
      status,
      endAt: raw.endAt,
      destName: raw.destName,
      souvenirs: raw.souvenirs || [],
    };
    if (status === 'at_home' || !trip) {
      patchProfile({ currentTripId: undefined });
    } else {
      patchProfile({ currentTripId: tripId });
    }
    if (status === 'returned') {
      emit(GameEvent.TRIP_RETURNED, { trip, delivered: advanced.delivered });
    }
    return { trip, delivered: advanced.delivered };
  } catch {
    return { trip: null, delivered: [] };
  }
}

export async function claimHome(): Promise<{ tripId: string; souvenirs: string[] }> {
  try {
    const res = await call<{ tripId: string; souvenirs: string[] }>('trip', {
      action: 'claimHome',
    });
    patchProfile({ currentTripId: undefined });
    emit(GameEvent.CHARACTER_VISIBLE);
    emit(GameEvent.TRIP_RETURNED, res);
    return res;
  } catch {
    let tripId = '';
    let souvenirs: string[] = [];
    try {
      const raw = wx.getStorageSync(TRIP_KEY) as {
        tripId?: string;
        souvenirs?: string[];
      } | '';
      if (raw && typeof raw === 'object') {
        tripId = raw.tripId || '';
        souvenirs = raw.souvenirs || [];
        wx.setStorageSync(TRIP_KEY, { ...raw, status: 'at_home' });
      }
    } catch {
      /* ignore */
    }
    patchProfile({ currentTripId: undefined });
    emit(GameEvent.CHARACTER_VISIBLE);
    return { tripId, souvenirs };
  }
}
