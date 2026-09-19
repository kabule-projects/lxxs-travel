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
  guideCompletedAt?: number | null;
  lastSpawnAt: number;
  nextSpawnAt: number;
  createdAt: number;
  lastLoginAt: number;
}

const TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

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
  const res = await withTimeout(
    wx.cloud.callFunction({ name, data }),
    TIMEOUT_MS,
    `云函数 ${name} 调用超时`,
  );
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

/** 新手奖励明信片（图鉴入库，firstUnlock=false 表示图鉴里已有） */
export interface GuideRewardPostcard {
  postcardId: string;
  title: string;
  rarity: string;
  type: string;
  imageThumb: string;
  imageFull: string;
  firstUnlock: boolean;
}

export interface GuideCompleteResult {
  guideCompletedAt: number;
  /** true=本次之前已领过（或并发抢占失败），不发奖 */
  alreadyClaimed: boolean;
  reward: {
    stars: number;
    riceStars: number;
    postcard: GuideRewardPostcard | null;
  } | null;
  /** 发放后的最新钱包（仅首次发放时下发） */
  wallet?: { stars: number; riceStars: number };
}

/** 新手指引完成（真实出发成功）回写：首次完成发放新手奖励，云端幂等 */
export async function completeGuideApi(): Promise<GuideCompleteResult> {
  return call<GuideCompleteResult>('login', { action: 'completeGuide' });
}

export async function ping(name: string): Promise<{ service: string; ts: number }> {
  return call(name, { action: 'ping' });
}

export { TIMEOUT_MS };
