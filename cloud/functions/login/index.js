const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const {
  newUserId,
  getUserByOpenid,
  mapUserPublic,
  ensureUserId,
} = require('./common/user');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function defaultNickName(userId) {
  const suffix = String(userId).replace(/-/g, '').slice(-4) || '0001';
  return `旅行者${suffix}`;
}

/** 新用户赠送 / 老用户补发的跳过旅行券张数（每次 skip 消耗 1 张） */
const DEFAULT_SKIP_TICKETS = 3;

async function createUser(openid) {
  const now = Date.now();
  const userId = newUserId();
  const doc = {
    userId,
    openid,
    nickName: defaultNickName(userId),
    avatarUrl: '',
    profileAuthorized: false,
    stars: 0,
    riceStars: 0,
    skipTickets: DEFAULT_SKIP_TICKETS,
    gm: false,
    pitySR: 0,
    pitySSR: 0,
    pityUR: 0,
    guideCompletedAt: null,
    guideRewardedAt: null,
    guideSeededAt: null,
    lastSpawnAt: now,
    nextSpawnAt: now + 600_000,
    createdAt: now,
    lastLoginAt: now,
  };
  const addRes = await db.collection('users').add({ data: doc });
  return { ...doc, _id: addRes._id };
}

/** 新手奖励配置：game_config key=guideReward；postcardId 为空 = 从启用明信片中随机抽一张 */
const DEFAULT_GUIDE_REWARD = { stars: 9, riceStars: 1, postcardId: '' };

async function loadGuideRewardConfig() {
  try {
    const res = await db
      .collection('game_config')
      .where({ key: 'guideReward' })
      .limit(1)
      .get();
    const raw = res.data[0] || {};
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    return {
      stars: num(raw.stars, DEFAULT_GUIDE_REWARD.stars),
      riceStars: num(raw.riceStars, DEFAULT_GUIDE_REWARD.riceStars),
      postcardId:
        typeof raw.postcardId === 'string'
          ? raw.postcardId
          : DEFAULT_GUIDE_REWARD.postcardId,
    };
  } catch (e) {
    return { ...DEFAULT_GUIDE_REWARD };
  }
}

/** 首次完成把奖励明信片写入图鉴（user_postcards 唯一索引 userId+postcardId 兜底并发）。
 *  postcardId 为空时从启用明信片中随机抽一张。 */
async function grantGuidePostcard(openid, postcardId) {
  let pc = null;
  if (postcardId) {
    const pcRes = await db
      .collection('postcards')
      .where({ id: postcardId, enabled: true })
      .limit(1)
      .get();
    pc = pcRes.data[0];
  } else {
    const all = await db
      .collection('postcards')
      .where({ enabled: true })
      .limit(100)
      .get();
    const list = all.data || [];
    pc = list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  if (!pc) return null;
  const album = await db
    .collection('user_postcards')
    .where({ userId: openid, postcardId: pc.id })
    .limit(1)
    .get();
  let firstUnlock = !album.data.length;
  if (firstUnlock) {
    try {
      await db.collection('user_postcards').add({
        data: {
          userId: openid,
          postcardId: pc.id,
          firstClaimedAt: Date.now(),
          claimCount: 1,
        },
      });
    } catch (e) {
      /* 撞唯一索引：已有记录 */
      firstUnlock = false;
    }
  }
  return {
    postcardId: pc.id,
    title: pc.title || '',
    rarity: pc.rarity || '',
    type: pc.type || 'postcard',
    imageThumb: pc.imageThumb || '',
    imageFull: pc.imageFull || '',
    firstUnlock,
  };
}

/**
 * 新手指引完成回写（真实出发成功后调用）。
 * 发奖闸：guideRewardedAt 原子认领（仍为 null 才更新成功），preReward/complete 并发/重复调用只发一次。
 * markCompleted=false 时只发奖不写 guideCompletedAt（preReward 提前发奖用），
 * 教程真正走完时再以 markCompleted=true 写入 guideCompletedAt。
 */
async function completeGuide(openid, markCompleted = true) {
  const user = await getUserByOpenid(db, openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');
  const ts = Date.now();
  // 老账号（历史上已完成教程）可能没有 guideRewardedAt 字段：以 guideCompletedAt 兜底视为已发奖，防重复发奖
  const claimedBefore = !!user.guideRewardedAt || !!user.guideCompletedAt;
  // 原子认领发奖闸
  const claim = await db
    .collection('users')
    .where({ _id: user._id, guideRewardedAt: null, guideCompletedAt: null })
    .update({ data: { guideRewardedAt: ts } });
  const claimed = !!(claim.stats && claim.stats.updated === 1);

  if (markCompleted) {
    await db
      .collection('users')
      .doc(user._id)
      .update({
        data: { guideCompletedAt: user.guideCompletedAt || ts },
      });
  }

  if (!claimed || claimedBefore) {
    return ok({
      guideCompletedAt: user.guideCompletedAt || (markCompleted ? ts : null),
      alreadyClaimed: true,
      reward: null,
    });
  }

  const cfg = await loadGuideRewardConfig();
  await db
    .collection('users')
    .doc(user._id)
    .update({
      data: { stars: _.inc(cfg.stars), riceStars: _.inc(cfg.riceStars) },
    });
  const postcard = await grantGuidePostcard(openid, cfg.postcardId);
  return ok({
    guideCompletedAt: markCompleted ? ts : null,
    alreadyClaimed: false,
    reward: { stars: cfg.stars, riceStars: cfg.riceStars, postcard },
    wallet: {
      stars: (user.stars || 0) + cfg.stars,
      riceStars: (user.riceStars || 0) + cfg.riceStars,
    },
  });
}

/** 老用户补发跳过券：字段缺失（建号早于 skip 功能上线）时补 DEFAULT_SKIP_TICKETS 张；
 *  已有数值（含花光后的 0）一律不动，保证只补一次。
 *  就地改 user 对象并返回需要写入的 patch（无需写入时返回 null）。 */
function migrateSkipTickets(user) {
  if (typeof user.skipTickets === 'number') return null;
  user.skipTickets = DEFAULT_SKIP_TICKETS;
  return { skipTickets: DEFAULT_SKIP_TICKETS };
}

/** 按 openid 静默登录；首访自动建号，无需头像昵称授权 */
async function session(openid) {
  let user = await getUserByOpenid(db, openid);
  if (!user) {
    user = await createUser(openid);
  }
  user = await ensureUserId(db, user);
  const now = Date.now();
  const skipPatch = migrateSkipTickets(user);
  // 未完成教程但小深已在旅途中：删除残留行程记录、清空 currentTripId，让教程从头开始
  if (!user.guideCompletedAt && user.currentTripId) {
    try {
      await db.collection('trips').doc(user.currentTripId).remove();
    } catch (e) {
      /* 行程记录可能已不存在 */
    }
    await db.collection('users').doc(user._id).update({
      data: { currentTripId: null, lastLoginAt: now, ...(skipPatch || {}) },
    });
    return ok({ ...mapUserPublic({ ...user, currentTripId: null, lastLoginAt: now }), needsProfile: false });
  }
  await db.collection('users').doc(user._id).update({
    data: { lastLoginAt: now, ...(skipPatch || {}) },
  });
  return ok({ ...mapUserPublic({ ...user, lastLoginAt: now }), needsProfile: false });
}

async function register(openid, profile) {
  const nickName = (profile?.nickName || '').trim();
  if (!nickName) return fail('请填写昵称', 'VALIDATION');

  const existing = await getUserByOpenid(db, openid);
  const now = Date.now();

  if (existing) {
    const user = await ensureUserId(db, existing);
    const patch = {
      nickName,
      avatarUrl: profile?.avatarUrl || user.avatarUrl || '',
      profileAuthorized: true,
      lastLoginAt: now,
      updatedAt: now,
      ...(migrateSkipTickets(user) || {}),
    };
    await db.collection('users').doc(user._id).update({ data: patch });
    return ok({
      ...mapUserPublic({ ...user, ...patch }),
      needsProfile: false,
    });
  }

  const doc = {
    userId: newUserId(),
    openid,
    nickName,
    avatarUrl: profile?.avatarUrl || '',
    profileAuthorized: true,
    stars: 0,
    riceStars: 0,
    skipTickets: DEFAULT_SKIP_TICKETS,
    gm: false,
    pitySR: 0,
    pitySSR: 0,
    pityUR: 0,
    guideCompletedAt: null,
    guideRewardedAt: null,
    guideSeededAt: null,
    lastSpawnAt: now,
    nextSpawnAt: now + 600_000,
    createdAt: now,
    lastLoginAt: now,
  };
  const addRes = await db.collection('users').add({ data: doc });
  return ok({ ...mapUserPublic({ ...doc, _id: addRes._id }), needsProfile: false });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');

    const action = event?.action || 'session';
    switch (action) {
      case 'ping':
        return ok({ service: 'login', ts: Date.now() });
      case 'register':
        return await register(OPENID, event.profile || event);
      case 'completeGuide':
        return await completeGuide(OPENID, event.markCompleted !== false);
      case 'session':
      default:
        return await session(OPENID);
    }
  } catch (e) {
    return fail(e.message || 'login error', e.code || 'ERROR');
  }
};
