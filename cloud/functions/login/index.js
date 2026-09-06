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

function defaultNickName(userId) {
  const suffix = String(userId).replace(/-/g, '').slice(-4) || '0001';
  return `旅行者${suffix}`;
}

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
    gm: false,
    pitySR: 0,
    pitySSR: 0,
    pityUR: 0,
    lastSpawnAt: now,
    nextSpawnAt: now + 600_000,
    createdAt: now,
    lastLoginAt: now,
  };
  const addRes = await db.collection('users').add({ data: doc });
  return { ...doc, _id: addRes._id };
}

/** 按 openid 静默登录；首访自动建号，无需头像昵称授权 */
async function session(openid) {
  let user = await getUserByOpenid(db, openid);
  if (!user) {
    user = await createUser(openid);
  }
  user = await ensureUserId(db, user);
  const now = Date.now();
  await db.collection('users').doc(user._id).update({
    data: { lastLoginAt: now },
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
    gm: false,
    pitySR: 0,
    pitySSR: 0,
    pityUR: 0,
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
      case 'session':
      default:
        return await session(OPENID);
    }
  } catch (e) {
    return fail(e.message || 'login error', e.code || 'ERROR');
  }
};
