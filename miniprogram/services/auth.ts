import { login } from './api';
import type { UserProfile } from './api';
import { setProfile } from '../store/user';

export interface RegisterProfileInput {
  nickName: string;
  avatarUrl?: string;
}

/** 静默登录：云端按 openid 自动建号；云端连不上直接抛错（loading 页弹窗重试）。
 *  会话缓存：命中时（TTL 12h 内）不发请求，直接恢复本地 profile，省每次冷启动的
 *  login callFunction（现状是 app onLaunch + loading bootstrap 各打一次，共 2 次）。
 *  不缓存的账号：教程未完成（login 服务端承担教程残留行程自愈，必须真实登录）与 GM
 *  （管理员 profile 需常新鲜，后台改动即时生效）。
 *  隔离性：小程序 storage 以微信账号维度隔离，换号登录读不到旧缓存，openid 字段仅作冗余校验。
 *  风险兜底：鉴权类错误（UNAUTHORIZED/NOT_FOUND）清缓存强制重登一次，避免缓存掩盖账号异常。 */
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_KEY = 'login-session-cache';
const AUTH_RETRY_CODES = ['UNAUTHORIZED', 'NOT_FOUND'];

interface SessionCache {
  v: number;
  openid: string;
  ts: number;
  profile: UserProfile;
}

function readCache(): SessionCache | null {
  let raw: unknown;
  try {
    raw = wx.getStorageSync(CACHE_KEY);
  } catch {
    return null;
  }
  const c = raw as SessionCache | '';
  if (!c || typeof c !== 'object' || c.v !== CACHE_VERSION || !c.profile || !c.openid) {
    return null;
  }
  return c;
}

function clearCache(): void {
  try {
    // 置空串而非 removeStorageSync：项目 wx 类型版本无该方法声明，运行时两者等价
    wx.setStorageSync(CACHE_KEY, '');
  } catch {
    /* ignore */
  }
}

/** 该 profile 是否允许走缓存：过期/教程期/GM 一律真实登录 */
function canServeCache(c: SessionCache): boolean {
  if (Date.now() - c.ts > CACHE_TTL_MS) return false;
  if (!c.profile.guideCompletedAt) return false;
  if (c.profile.gm) return false;
  return true;
}

/** 并发合并：app onLaunch 与 loading bootstrap 同帧各调一次 ensureSession 时共享同一请求 */
let inflight: Promise<UserProfile> | null = null;

export function ensureSession(force = false): Promise<UserProfile> {
  if (inflight) return inflight;
  const p = doEnsureSession(force);
  inflight = p;
  // 不用 finally（项目 target 低于 es2018）： settled 后清 inflight，供下次调用
  const clear = (): void => {
    if (inflight === p) inflight = null;
  };
  p.then(clear, clear);
  return p;
}

async function doEnsureSession(force: boolean): Promise<UserProfile> {
  if (!force) {
    const cached = readCache();
    if (cached && canServeCache(cached)) {
      setProfile(cached.profile);
      return cached.profile;
    }
  }
  try {
    const profile = await login();
    if (!profile.userId) {
      throw new Error('会话创建失败');
    }
    setProfile(profile);
    if (profile.guideCompletedAt && !profile.gm) {
      try {
        wx.setStorageSync(CACHE_KEY, {
          v: CACHE_VERSION,
          openid: profile.openid,
          ts: Date.now(),
          profile,
        } satisfies SessionCache);
      } catch {
        /* 写失败不影响登录 */
      }
    } else {
      clearCache();
    }
    return profile;
  } catch (e) {
    const code = (e as Error & { code?: string })?.code || '';
    if (!force && AUTH_RETRY_CODES.includes(code)) {
      // 账号被删/迁移等异常：清缓存后强制重登一次（登录器会按 openid 重建）
      clearCache();
      return doEnsureSession(true);
    }
    throw e;
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
