import { call } from './api';
import type { UserProfile } from './api';
import { setProfile } from '../store/user';

const LOCAL_USER_KEY = 'lxxs_local_user';

export interface RegisterProfileInput {
  nickName: string;
  avatarUrl?: string;
}

function localUserId(): string {
  try {
    const raw = wx.getStorageSync(LOCAL_USER_KEY) as { userId?: string } | '';
    if (raw && typeof raw === 'object' && raw.userId) return raw.userId;
  } catch {
    /* ignore */
  }
  const userId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    wx.setStorageSync(LOCAL_USER_KEY, { userId });
  } catch {
    /* ignore */
  }
  return userId;
}

function localProfile(partial: RegisterProfileInput): UserProfile {
  const now = Date.now();
  const userId = localUserId();
  return {
    userId,
    openid: '',
    nickName: partial.nickName,
    avatarUrl: partial.avatarUrl || '',
    profileAuthorized: true,
    needsProfile: false,
    stars: 0,
    riceStars: 0,
    gm: false,
    pitySR: 0,
    pitySSR: 0,
    pityUR: 0,
    lastSpawnAt: now,
    nextSpawnAt: now,
    createdAt: now,
    lastLoginAt: now,
  };
}

/** 检查是否已注册；未注册返回 needsProfile */
export async function checkSession(): Promise<UserProfile> {
  try {
    return await call<UserProfile>('login', { action: 'session' });
  } catch {
    return {
      userId: '',
      openid: '',
      needsProfile: true,
      stars: 0,
      riceStars: 0,
      gm: false,
      pitySR: 0,
      pitySSR: 0,
      pityUR: 0,
      lastSpawnAt: 0,
      nextSpawnAt: 0,
      createdAt: 0,
      lastLoginAt: 0,
    };
  }
}

/** 初次授权后注册，服务端分配 userId */
export async function registerProfile(
  input: RegisterProfileInput,
): Promise<UserProfile> {
  try {
    const profile = await call<UserProfile>('login', {
      action: 'register',
      profile: input,
    });
    setProfile(profile);
    return profile;
  } catch {
    const profile = localProfile(input);
    setProfile(profile);
    return profile;
  }
}

export async function uploadAvatar(tempPath: string, userId: string): Promise<string> {
  if (!wx.cloud || !tempPath) return tempPath;
  try {
    const res = await wx.cloud.uploadFile({
      cloudPath: `avatars/${userId}.webp`,
      filePath: tempPath,
    });
    return res.fileID;
  } catch {
    return tempPath;
  }
}
