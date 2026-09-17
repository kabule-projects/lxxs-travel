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

/** 新手指引：8 颗普通星 + 1 颗米星；教学购买的第一件食物（与客户端 GUIDE 配置一致） */
const GUIDE_NORMAL_STARS = 8;
const GUIDE_RICE_STARS = 1;
const GUIDE_FOOD_ITEM = 'potato';

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
    guide: !!doc.guide,
    spawnAt: doc.spawnAt,
    dropAt: doc.dropAt,
  };
}

/**
 * 未完成指引的用户再次冷启动：经济清零重来（用户修订：教学经济不保留）。
 * 只清教学期间产生的记录（guide 标记 / 教学食物购买记录），不误伤老用户存量数据。
 */
async function resetGuideProgress(openid, userId, now) {
  await db.collection('roof_stars').where({ userId: openid }).remove();
  await db
    .collection('user_inventory')
    .where({ userId: openid, guide: true })
    .remove();
  await db.collection('user_gacha').where({ userId: openid, guide: true }).remove();
  // 教学购买已不写 daily_purchases（不占每日额度）；
  // 这里仅清理旧版本可能留下的带 guide 标记记录，绝不误删正式购买
  await db
    .collection('daily_purchases')
    .where({ userId: openid, itemId: GUIDE_FOOD_ITEM, guide: true })
    .remove();
  await db.collection('users').doc(userId).update({
    data: {
      stars: 0,
      riceStars: 0,
      pitySR: 0,
      pitySSR: 0,
      pityUR: 0,
      guideSeededAt: null,
      nextSpawnAt: now + STAR_INTERVAL_MIN_MS,
      lastSpawnAt: now,
    },
  });
}

/** 一次性播种教学掉落星：8 普通 + 1 米；先置 guideSeededAt 幂等标志再插入 */
async function seedGuideStars(openid, now) {
  await db.collection('users').where({ openid }).update({
    data: { guideSeededAt: now },
  });
  const stars = [];
  const total = GUIDE_NORMAL_STARS + GUIDE_RICE_STARS;
  for (let i = 0; i < total; i += 1) {
    const pile = randomPilePos(i);
    const doc = {
      userId: openid,
      type: i < GUIDE_NORMAL_STARS ? 'normal' : 'rice',
      status: 'dropped',
      guide: true,
      ...pile,
      skyX: 0,
      skyY: 0,
      spawnAt: now,
      dropAt: now,
    };
    const addRes = await db.collection('roof_stars').add({ data: doc });
    stars.push({ ...doc, _id: addRes._id });
  }
  return stars;
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
  let user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const now = Date.now();
  const inGuide = !user.guideCompletedAt;
  // 未完成指引且此前已播种过 → 冷启动重开，先清零教学经济再从头播种
  if (inGuide && user.guideSeededAt) {
    await resetGuideProgress(openid, user._id, now);
    user = await getUser(openid);
  }

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

  // 首次激活指引：一次性播种 8 普通 + 1 米（guideSeededAt 幂等）
  if (inGuide && !user.guideSeededAt) {
    const guideStars = await seedGuideStars(openid, now);
    dropped.push(...guideStars);
  }

  await db.collection('users').doc(user._id).update({
    data: { nextSpawnAt, lastSpawnAt: now },
  });

  // 重置后 user 已重载；播种不改余额，stars/riceStars 直接取 user 即可
  const guideDropped = dropped.filter((s) => s.guide).length;
  return ok({
    stars: user.stars || 0,
    riceStars: user.riceStars || 0,
    nextSpawnAt,
    guideDropped,
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
