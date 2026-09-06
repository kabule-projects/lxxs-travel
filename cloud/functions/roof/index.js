const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const {
  STAR_INTERVAL_MIN_MS,
  STAR_INTERVAL_MAX_MS,
  STAR_PENDING_CAP,
  STAR_DROPPED_CAP,
  randomInterval,
  randomSkyPos,
  randomPilePos,
  isRice,
} = require('./common/game');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function mapStar(doc) {
  return {
    id: doc._id,
    type: doc.type,
    status: doc.status,
    skyX: doc.skyX,
    skyY: doc.skyY,
    x: doc.x,
    y: doc.y,
    rotate: doc.rotate || 0,
    spawnAt: doc.spawnAt,
    dropAt: doc.dropAt,
  };
}

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

async function listByStatus(openid, status) {
  const res = await db
    .collection('roof_stars')
    .where({ userId: openid, status })
    .get();
  return res.data;
}

async function syncStars(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const now = Date.now();
  let pending = await listByStatus(openid, 'pending');
  let dropped = await listByStatus(openid, 'dropped');
  let nextSpawnAt = user.nextSpawnAt || now;

  const due = pending.filter((s) => s.dropAt <= now).sort((a, b) => a.dropAt - b.dropAt);
  for (const star of due) {
    if (dropped.length >= STAR_DROPPED_CAP) break;
    const pile = randomPilePos(dropped.length);
    await db.collection('roof_stars').doc(star._id).update({
      data: { status: 'dropped', ...pile },
    });
    dropped.push({ ...star, status: 'dropped', ...pile });
    pending = pending.filter((s) => s._id !== star._id);
  }

  let guard = 0;
  while (now >= nextSpawnAt && pending.length < STAR_PENDING_CAP && guard < 8) {
    guard += 1;
    const sky = randomSkyPos(pending.length);
    const doc = {
      userId: openid,
      type: isRice() ? 'rice' : 'normal',
      status: 'pending',
      ...sky,
      x: 0,
      y: 0,
      rotate: 0,
      spawnAt: now,
      dropAt: now + randomInterval(STAR_INTERVAL_MIN_MS, STAR_INTERVAL_MAX_MS),
    };
    const addRes = await db.collection('roof_stars').add({ data: doc });
    pending.push({ ...doc, _id: addRes._id });
    nextSpawnAt = now + randomInterval(STAR_INTERVAL_MIN_MS, STAR_INTERVAL_MAX_MS);
  }

  if (pending.length >= STAR_PENDING_CAP && now >= nextSpawnAt) {
    nextSpawnAt = now + randomInterval(STAR_INTERVAL_MIN_MS, STAR_INTERVAL_MAX_MS);
  }

  await db.collection('users').doc(user._id).update({
    data: { nextSpawnAt, lastSpawnAt: now },
  });

  return ok({
    stars: user.stars || 0,
    riceStars: user.riceStars || 0,
    nextSpawnAt,
    pending: pending.map(mapStar),
    dropped: dropped.map(mapStar),
  });
}

async function collectStar(openid, starId) {
  if (!starId) return fail('缺少 starId', 'VALIDATION');
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const starRes = await db.collection('roof_stars').doc(starId).get();
  const star = starRes.data;
  if (!star || star.userId !== openid || star.status !== 'dropped') {
    return fail('星星不可收取', 'CONFLICT');
  }

  const now = Date.now();
  const patch = {};
  if (star.type === 'rice') {
    patch.riceStars = _.inc(1);
  } else {
    patch.stars = _.inc(1);
  }

  await db.collection('roof_stars').doc(starId).update({
    data: { status: 'collected', collectedAt: now },
  });
  await db.collection('users').doc(user._id).update({ data: patch });

  const fresh = await getUser(openid);
  return ok({
    id: starId,
    type: star.type,
    stars: fresh.stars || 0,
    riceStars: fresh.riceStars || 0,
  });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const { action } = event || {};

    switch (action) {
      case 'sync':
        return await syncStars(OPENID);
      case 'collect':
        return await collectStar(OPENID, event.starId);
      case 'ping':
        return ok({ service: 'roof', ts: Date.now() });
      default:
        return fail(`未知 action: ${action}`, 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'roof error', e.code || 'ERROR');
  }
};
