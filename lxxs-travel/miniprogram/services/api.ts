export interface CloudResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface UserProfile {
  _id?: string;
  userId: string;
  openid: string;
  nickName?: string;
  avatarUrl?: string;
  profileAuthorized?: boolean;
  needsProfile?: boolean;
  stars: number;
  riceStars: number;
  gm: boolean;
  pitySR: number;
  pitySSR: number;
  pityUR: number;
  currentTripId?: string;
  lastSpawnAt: number;
  nextSpawnAt: number;
  createdAt: number;
  lastLoginAt: number;
}

const TIMEOUT_MS = 15000;

function normalizeResult<T>(raw: unknown): CloudResult<T> {
  if (raw && typeof raw === 'object' && 'ok' in (raw as object)) {
    return raw as CloudResult<T>;
  }
  return { ok: true, data: raw as T };
}

export async function call<T>(
  name: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  if (!wx.cloud) {
    throw new Error('云开发不可用');
  }
  const res = await wx.cloud.callFunction({ name, data });
  const result = normalizeResult<T>(res.result);
  if (!result.ok) {
    const err = new Error(result.error || '云函数错误');
    (err as Error & { code?: string }).code = result.code;
    throw err;
  }
  return result.data as T;
}

export async function login(): Promise<UserProfile> {
  return call<UserProfile>('login', { action: 'session' });
}

export async function ping(name: string): Promise<{ service: string; ts: number }> {
  return call(name, { action: 'ping' });
}

export { TIMEOUT_MS };
