import { claimHome, syncTrip, type TripSyncResult } from './trip';
import { prefetchShowcase } from './showcase';
import { emit, GameEvent } from '../utils/event-bus';

export const TRIP_BANNER_MS = 5000;

export interface TripBannerState {
  visible: boolean;
  mode: 'depart' | 'return' | null;
  /** mode=return 时：本行程是否带回了纪念品（决定用哪张回家提示图） */
  returnHasSouvenir?: boolean;
}

export interface TripSyncView {
  banner: TripBannerState;
  showCharacter: boolean;
  sync: TripSyncResult;
}

let returnHandledTripId: string | null = null;
let bannerTimer: 0 | number = 0;
let watchTimer: 0 | number = 0;

export function clearTripBannerTimer() {
  if (bannerTimer) {
    clearTimeout(bannerTimer);
    bannerTimer = 0;
  }
}

/** @deprecated use clearTripBannerTimer */
export const clearReturnBannerTimer = clearTripBannerTimer;

export function stopReturnWatch() {
  if (watchTimer) {
    clearTimeout(watchTimer);
    watchTimer = 0;
  }
}

/** 出发提示：显示 5 秒后隐藏（旅行期间不再显示） */
export function runDepartBannerFlow(onHide: () => void) {
  clearTripBannerTimer();
  bannerTimer = setTimeout(() => {
    bannerTimer = 0;
    // 页面可能已卸载（横幅展示期间被切走/返回），隐藏失败不影响流程
    try {
      onHide();
    } catch {
      /* ignore */
    }
  }, TRIP_BANNER_MS) as unknown as number;
}

export function scheduleReturnWatch(endAt?: number, onReturn?: () => void) {
  stopReturnWatch();
  if (!endAt) return;
  const delay = Math.max(0, endAt - Date.now() + 400);
  watchTimer = setTimeout(async () => {
    watchTimer = 0;
    const res = await syncTrip();
    if (res.trip?.status === 'returned') {
      // 只当唤醒通知：各页面收到后重跑 syncTripState，横幅展示统一由 resolveTripSyncView 负责
      emit(GameEvent.TRIP_RETURNED, res);
      onReturn?.();
    }
  }, delay) as unknown as number;
}

export async function resolveTripSyncView(): Promise<TripSyncView> {
  const sync = await syncTrip();
  const trip = sync.trip;

  if (!trip || trip.status === 'at_home') {
    stopReturnWatch();
    return {
      banner: { visible: false, mode: null },
      showCharacter: true,
      sync,
    };
  }

  if (trip.status === 'traveling') {
    // 到点唤醒：emit 通知页面重同步，横幅展示由 resolveTripSyncView 统一负责
    scheduleReturnWatch(trip.endAt);
    return {
      banner: { visible: false, mode: null },
      showCharacter: false,
      sync,
    };
  }

  if (trip.status === 'returned') {
    stopReturnWatch();
    // 同一行程的回家横幅只展示一遍：已展示过（收下倒计时进行中）则不再播，
    // 避免切换页面后横幅重新出现且无人收尾；冷启动（进程重开）守卫清空，仍会再播一次。
    if (isReturnBannerHandled(trip._id)) {
      return {
        banner: { visible: false, mode: null },
        showCharacter: true,
        sync,
      };
    }
    return {
      banner: {
        visible: true,
        mode: 'return',
        returnHasSouvenir: hasNewReturnSouvenir(trip),
      },
      showCharacter: true,
      sync,
    };
  }

  return {
    banner: { visible: false, mode: null },
    showCharacter: true,
    sync,
  };
}

/** 归来收尾：收下旅行、清本地/内存旅行态、通知各页小深现身 */
async function finishReturnFlow(tripId: string, onHide: () => void) {
  try {
    await claimHome();
    // 新伴手礼已入库：刷新展示柜缓存（下次进页面直接是最新）
    void prefetchShowcase();
  } catch {
    /* 可能已 claim */
  }
  emit(GameEvent.CHARACTER_VISIBLE);
  returnHandledTripId = null;
  // 页面可能已卸载（横幅展示期间被切走/返回），隐藏失败不影响收尾
  try {
    onHide();
  } catch {
    /* ignore */
  }
}

/** 回家横幅是否已为该行程展示过（收下倒计时进行中，不再重复展示） */
export function isReturnBannerHandled(tripId: string): boolean {
  return !!tripId && returnHandledTripId === tripId;
}

/**
 * 回家横幅是否用"带礼物"图：只有带回的纪念品是新品（用户之前没有）才用。
 * souvenirNew 由服务端在发放时查重写入；老行程无此字段则回退到"有纪念品即带礼物"。
 */
export function hasNewReturnSouvenir(trip: {
  souvenirs?: string[];
  souvenirNew?: boolean;
}): boolean {
  if (typeof trip.souvenirNew === 'boolean') return trip.souvenirNew;
  return (trip.souvenirs?.length ?? 0) > 0;
}

/** 归来提示：5 秒后 claimHome 并隐藏 */
export function runReturnBannerFlow(
  tripId: string,
  onHide: () => void,
): boolean {
  if (!tripId || isReturnBannerHandled(tripId)) return false;
  returnHandledTripId = tripId;
  clearTripBannerTimer();
  bannerTimer = setTimeout(() => {
    bannerTimer = 0;
    finishReturnFlow(tripId, onHide);
  }, TRIP_BANNER_MS) as unknown as number;
  return true;
}

/** 点击横幅立即收下并隐藏（跳过 5 秒等待）；未在展示该行程时返回 false */
export function dismissReturnBanner(tripId: string, onHide: () => void): boolean {
  if (!tripId || returnHandledTripId !== tripId) return false;
  clearTripBannerTimer();
  finishReturnFlow(tripId, onHide);
  return true;
}

export function resetReturnBannerGuard() {
  returnHandledTripId = null;
}
