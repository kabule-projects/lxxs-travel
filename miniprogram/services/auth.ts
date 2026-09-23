import { call } from './api';
import type { UserProfile } from './api';
import { setProfile } from '../store/user';

export interface RegisterProfileInput {
  nickName: string;
  avatarUrl?: string;
}

/** 静默登录：云端按 openid 自动建号；云端连不上直接抛错（loading 页弹窗重试） */
export async function ensureSession(): Promise<UserProfile> {
  const profile = await call<UserProfile>('login', { action: 'session' });
  if (!profile.userId) {
    throw new Error('会话创建失败');
  }
  setProfile(profile);
  return profile;
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
