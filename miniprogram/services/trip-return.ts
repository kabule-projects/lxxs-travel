import { claimHome, syncTrip, type TripSyncResult } from './trip';
import { setLocalTraveling } from './postcard';
import { emit, GameEvent } from '../utils/event-bus';

export const TRIP_BANNER_MS = 5000;

export interface TripBannerState {
  visible: boolean;
  mode: 'depart' | 'return' | null;
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
    onHide();
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
    scheduleReturnWatch(trip.endAt, () => {
      emit(GameEvent.TRIP_RETURNED, { trip });
    });
    return {
      banner: { visible: false, mode: null },
      showCharacter: false,
      sync,
    };
  }

  if (trip.status === 'returned') {
    stopReturnWatch();
    return {
      banner: {
        visible: true,
        mode: 'return',
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

/** 归来提示：5 秒后 claimHome 并隐藏 */
export function runReturnBannerFlow(
  tripId: string,
  onHide: () => void,
): boolean {
  if (!tripId || returnHandledTripId === tripId) return false;
  returnHandledTripId = tripId;
  clearTripBannerTimer();
  bannerTimer = setTimeout(async () => {
    bannerTimer = 0;
    try {
      await claimHome();
    } catch {
      /* 可能已 claim */
    }
    setLocalTraveling(false);
    emit(GameEvent.CHARACTER_VISIBLE);
    returnHandledTripId = null;
    onHide();
  }, TRIP_BANNER_MS) as unknown as number;
  return true;
}

export function resetReturnBannerGuard() {
  returnHandledTripId = null;
}
