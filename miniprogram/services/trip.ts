import { call } from './api';
import { consumeItems } from './inventory';
import { getRiceStars, patchProfile, setRiceStars } from '../store/user';
import { emit, GameEvent } from '../utils/event-bus';

export interface TripLoadout {
  bento: string;
  riceStar?: boolean;
  props?: string[];
}

export interface TripStartResult {
  tripId: string;
  foodId: string;
  foodName: string;
  startAt: number;
  endAt: number;
  usedRiceStar: boolean;
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
    /** 云端已扣食物；道具非消耗品，仍留在背包中 */
    consumeItems([loadout.bento]);
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
    // 云端失败直接抛错，不再本地模拟行程（避免本地/云端数据互相打架）
    throw e;
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
    /* 文案兜底，不涉及数据 */
  }
  return fallback[Math.floor(Math.random() * fallback.length)];
}

export interface TripSyncResult {
  trip: {
    _id: string;
    status: string;
    foodName?: string;
    endAt?: number;
    souvenirs?: string[];
    /** true=本趟带回的纪念品是新品（前端据此播"带礼物回家"横幅）；false=已拥有；老数据无此字段 */
    souvenirNew?: boolean;
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
    // 注意：这里不能 emit TRIP_RETURNED——调用方 resolveTripSyncView 才是横幅唯一展示入口，
    // 事件先行显示会先把"已展示"守卫置上，导致 resolveTripSyncView 判定为已处理而把横幅压掉
    return res;
  } catch (e) {
    // 云端连不上直接抛错，不再回落本地模拟行程
    throw e;
  }
}

export async function claimHome(): Promise<{ tripId: string; souvenirs: string[] }> {
  const res = await call<{ tripId: string; souvenirs: string[] }>('trip', {
    action: 'claimHome',
  });
  patchProfile({ currentTripId: undefined });
  emit(GameEvent.CHARACTER_VISIBLE);
  return res;
}
