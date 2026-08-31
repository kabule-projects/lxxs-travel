const crypto = require('crypto');

function newUserId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `u_${crypto.randomBytes(16).toString('hex')}`;
}

async function getUserByOpenid(db, openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get();
  return res.data[0] || null;
}

function mapUserPublic(user) {
  if (!user) return null;
  return {
    _id: user._id,
    userId: user.userId,
    openid: user.openid,
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
    profileAuthorized: !!user.profileAuthorized,
    stars: user.stars || 0,
    riceStars: user.riceStars || 0,
    gm: !!user.gm,
    pitySR: user.pitySR || 0,
    pitySSR: user.pitySSR || 0,
    pityUR: user.pityUR || 0,
    currentTripId: user.currentTripId || null,
    lastSpawnAt: user.lastSpawnAt || 0,
    nextSpawnAt: user.nextSpawnAt || 0,
    createdAt: user.createdAt || 0,
    lastLoginAt: user.lastLoginAt || 0,
  };
}

/** 旧用户补 userId（openid 与 userId 一一对应） */
async function ensureUserId(db, user) {
  if (!user || user.userId) return user;
  const userId = newUserId();
  await db.collection('users').doc(user._id).update({
    data: { userId, updatedAt: Date.now() },
  });
  return { ...user, userId };
}

module.exports = {
  newUserId,
  getUserByOpenid,
  mapUserPublic,
  ensureUserId,
};
