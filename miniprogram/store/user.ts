import type { UserProfile } from '../services/api';
import { emit, GameEvent } from '../utils/event-bus';

interface UserState {
  profile: UserProfile | null;
  ready: boolean;
  traveling: boolean;
}

const state: UserState = {
  profile: null,
  ready: false,
  traveling: false,
};

export function getUserId(): string {
  return state.profile?.userId ?? '';
}

export function getProfile(): UserProfile | null {
  return state.profile;
}

export function getStars(): number {
  return state.profile?.stars ?? 0;
}

export function getRiceStars(): number {
  return state.profile?.riceStars ?? 0;
}

export function setStars(stars: number): void {
  if (!state.profile) {
    state.profile = {
      userId: '',
      openid: '',
      stars,
      riceStars: 0,
      gm: false,
      pitySR: 0,
      pitySSR: 0,
      pityUR: 0,
      lastSpawnAt: Date.now(),
      nextSpawnAt: Date.now(),
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    } as UserProfile;
  } else {
    state.profile = { ...state.profile, stars };
  }
  emit(GameEvent.STARS_UPDATED, { stars });
}

export function setRiceStars(riceStars: number): void {
  if (!state.profile) return;
  state.profile = { ...state.profile, riceStars };
}

export function isReady(): boolean {
  return state.ready;
}

export function isTraveling(): boolean {
  return state.traveling;
}

export function setProfile(profile: UserProfile): void {
  state.profile = profile;
  state.ready = true;
  state.traveling = !!profile.currentTripId;
  emit(GameEvent.STARS_UPDATED, { stars: profile.stars });
}

export function patchProfile(patch: Partial<UserProfile>): void {
  if (!state.profile) return;
  state.profile = { ...state.profile, ...patch };
  if (patch.stars != null) {
    emit(GameEvent.STARS_UPDATED, { stars: patch.stars });
  }
  if (patch.currentTripId !== undefined) {
    state.traveling = !!patch.currentTripId;
  }
}

export function reset(): void {
  state.profile = null;
  state.ready = false;
  state.traveling = false;
}
