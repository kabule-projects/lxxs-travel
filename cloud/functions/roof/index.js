const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const {
  STAR_INTERVAL_MIN_MS,
  STAR_DROPPED_CAP,
  STAR_TOTAL_CAP,
  STAR_AWAY_MS,
  STAR_SPAWN_GAP_MIN_MS,
  STAR_SPAWN_GAP_MAX_MS,
  STAR_DROP_MIN_MS,
  STAR_DROP_MAX_MS,
  randomInterval,
  randomSkyPos,
  randomPilePos,
  isRice,
} = require('./common/game');
const { collectAndTrimUnread, resolvePigeonState } = require('./common/mail-box');
const { advanceTrip } = require('./common/trip-lifecycle');
const {
  normalizePostcardSnapshot,
} = require('./common/postcard-images');

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
 * 未完成指引的用户冷启动重开教程：经济清零重来（教学经济不保留）。
 * 只清教学期间产生的记录（guide 标记 / 教学食物购买记录），不误伤老用户存量数据。
 * ⚠️ 只能由客户端冷启动激活指引时携带 restartGuide=true 触发——
 * 若在每次 sync 都执行，收取后的计数会被立刻清零、星星也会重新刷出。
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

async function syncStars(openid, restartGuide) {
  let user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const now = Date.now();
  const inGuide = !user.guideCompletedAt;
  // 仅当客户端冷启动重开教程（restartGuide=true）时清零教学经济再从头播种；
  // 会话内的普通 sync 绝不重置，否则收取后的计数会被清零、星星重新刷出
  if (restartGuide && inGuide && user.guideSeededAt) {
    await resetGuideProgress(openid, user._id, now);
    user = await getUser(openid);
  }

  let pending = await listByStatus(openid, 'pending');
  let dropped = await listByStatus(openid, 'dropped');
  let nextSpawnAt = user.nextSpawnAt || now;

  /** 到期 pending → 落地（闭包共享 pending/dropped） */
  async function dropDue() {
    const due = pending
      .filter((s) => s.dropAt <= now)
      .sort((a, b) => a.dropAt - b.dropAt);
    for (const star of due) {
      if (dropped.length >= STAR_DROPPED_CAP) break;
      const pile = randomPilePos(dropped.length);
      await db.collection('roof_stars').doc(star._id).update({
        data: { status: 'dropped', ...pile },
      });
      dropped.push({ ...star, status: 'dropped', ...pile });
      pending = pending.filter((s) => s._id !== star._id);
    }
  }

  await dropDue();

  // 随机节奏生成 + 离线补刷：按 nextSpawnAt 闸门逐颗推进——在线时到点只生成 1 颗；
  // 离线回归时把错过的间隔按虚拟时钟补齐（nextSpawnAt 一路推进到未来），
  // 每颗的掉落时刻 = 它的"生成时刻" + 天上停留随机（4min~8h）——
  // 所以回归用户上线即看到：天上挂着几颗新的（生成晚/停留久），地上已掉了几颗（生成早/停留短）。
  // 同屏总量封顶 STAR_TOTAL_CAP；指引期间抑制普通星刷新，保持画面只有 9 颗教学星。
  // 封顶时的"错过的生成"：在线（距上次 sync < STAR_AWAY_MS）直接丢弃并重新随机排期，
  // 不会点掉一颗立刻补一颗；离线回归才按上面的虚拟时钟补刷。
  // 同理，在线时若闸门在上次 sync 之前就已过期（空位是刚收取/掉落腾出来的），
  // 这次"到期的生成"视为错过的，丢弃并重新随机排期，不立即补位。
  const lastSyncAt = user.lastSpawnAt || 0;
  const away = now - lastSyncAt > STAR_AWAY_MS;
  let guard = 0;
  if (!inGuide) {
    while (guard < STAR_TOTAL_CAP) {
      guard += 1;
      if (now < nextSpawnAt) break;
      if (pending.length + dropped.length >= STAR_TOTAL_CAP) {
        if (!away) {
          nextSpawnAt =
            now + randomInterval(STAR_SPAWN_GAP_MIN_MS, STAR_SPAWN_GAP_MAX_MS);
        }
        break;
      }
      if (!away && nextSpawnAt < lastSyncAt) {
        nextSpawnAt =
          now + randomInterval(STAR_SPAWN_GAP_MIN_MS, STAR_SPAWN_GAP_MAX_MS);
        break;
      }
      const spawnAt = Math.min(nextSpawnAt, now);
      const sky = randomSkyPos(pending.length);
      const doc = {
        userId: openid,
        type: isRice() ? 'rice' : 'normal',
        status: 'pending',
        ...sky,
        x: 0,
        y: 0,
        rotate: 0,
        spawnAt,
        dropAt: spawnAt + randomInterval(STAR_DROP_MIN_MS, STAR_DROP_MAX_MS),
      };
      const addRes = await db.collection('roof_stars').add({ data: doc });
      pending.push({ ...doc, _id: addRes._id });
      nextSpawnAt =
        nextSpawnAt + randomInterval(STAR_SPAWN_GAP_MIN_MS, STAR_SPAWN_GAP_MAX_MS);
    }
  }

  // 补刷的星里 dropAt 已落在过去的（离线期间生成且停留短的）本轮立即落地
  await dropDue();

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

async function collectAllStars(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const dropped = await listByStatus(openid, 'dropped');
  if (!dropped.length) {
    return ok({
      collected: 0,
      normal: 0,
      rice: 0,
      stars: user.stars || 0,
      riceStars: user.riceStars || 0,
    });
  }

  const rice = dropped.filter((s) => s.type === 'rice').length;
  const normal = dropped.length - rice;
  const now = Date.now();
  for (const star of dropped) {
    await db.collection('roof_stars').doc(star._id).update({
      data: { status: 'collected', collectedAt: now },
    });
  }
  await db.collection('users').doc(user._id).update({
    data: { stars: _.inc(normal), riceStars: _.inc(rice) },
  });

  const fresh = await getUser(openid);
  return ok({
    collected: dropped.length,
    normal,
    rice,
    stars: fresh.stars || 0,
    riceStars: fresh.riceStars || 0,
  });
}

/** ============ syncAll：一次返回 星星+行程+信箱 三段（roof onShow 三连合并用） ============
 *  各段结构与 roof.sync / trip.sync / postcard.mailbox 的输出保持一致；
 *  行程推进（advanceTrip）整次只执行一遍，行程段与信箱段共享结果 */

/** 批量回查 postcards 主表（batch 20，_.in），返回 id -> 完整文档 Map */
async function loadPostcardDocMap(postcardIds) {
  const map = new Map();
  const uniq = [...new Set((postcardIds || []).filter(Boolean))];
  if (!uniq.length) return map;

  const batchSize = 20;
  for (let i = 0; i < uniq.length; i += batchSize) {
    const chunk = uniq.slice(i, i + batchSize);
    try {
      const res = await db
        .collection('postcards')
        .where({ id: _.in(chunk) })
        .limit(batchSize)
        .get();
      for (const doc of res.data || []) {
        if (doc && doc.id) map.set(doc.id, doc);
      }
    } catch (e) {
      /* ignore batch failure */
    }
  }
  return map;
}

/** 加载并推进全部邮件行程（traveling/returned 走 advanceTrip；at_home 原样保留）。
 *  返回 { active: [{trip,delivered,souvenirGranted}], home: [tripDoc] }，行程推进只此一遍 */
async function loadMailTripsAdvanced(openid) {
  const [activeRes, homeRes] = await Promise.all([
    db
      .collection('trips')
      .where({ userId: openid, status: _.in(['traveling', 'returned']) })
      .limit(20)
      .get(),
    db
      .collection('trips')
      .where({ userId: openid, status: 'at_home' })
      // 取【最新】50 趟：未收的信集中在最近结束的行程里；
      // 无 orderBy 时自然序按创建时间升序，老玩家（>50 趟）会整页错过新行程，信件永不出现
      .orderBy('endAt', 'desc')
      .limit(50)
      .get(),
  ]);

  const active = [];
  for (const raw of activeRes.data || []) {
    active.push(await advanceTrip(db, _, { ...raw, _id: raw._id }, null));
  }
  const home = (homeRes.data || []).map((t) => ({ ...t, _id: t._id }));
  return { active, home };
}

/** 行程段：与 cloud/functions/trip syncTrip 同语义（含 returned 孤儿自愈）。
 *  返回 { currentTripId, trip, delivered, souvenirGranted }——currentTripId 为自愈后的生效值，
 *  供信箱段计算 traveling/hasDelivered，避免用陈旧 user 快照 */
async function loadTripSection(openid, user, active, home) {
  let currentTripId = user.currentTripId;
  if (!currentTripId) {
    const latest = active
      .filter((a) => a.trip.status === 'returned')
      .reduce(
        (a, b) =>
          a === null || (b.trip.endAt || 0) > (a.trip.endAt || 0) ? b : a,
        null,
      );
    if (latest) {
      await db.collection('users').doc(user._id).update({
        data: { currentTripId: latest.trip._id },
      });
      currentTripId = latest.trip._id;
    }
  }
  if (!currentTripId) {
    return { currentTripId: null, trip: null, delivered: [], souvenirGranted: null };
  }

  const hit = active.find((a) => a.trip._id === currentTripId);
  if (hit) {
    return {
      currentTripId,
      trip: hit.trip,
      delivered: hit.delivered,
      souvenirGranted: hit.souvenirGranted,
    };
  }
  // currentTripId 指向 at_home 历史行程：原样返回（与旧 trip.sync 对 at_home 文档 advanceTrip 的行为对齐）
  const homeHit = home.find((t) => t._id === currentTripId);
  if (homeHit) {
    return { currentTripId, trip: homeHit, delivered: [], souvenirGranted: null };
  }
  await db.collection('users').doc(user._id).update({
    data: { currentTripId: null },
  });
  return { currentTripId: null, trip: null, delivered: [], souvenirGranted: null };
}

/** 信箱段：与 cloud/functions/postcard mailboxSync 同输出。
 *  effectiveTripId 传行程段自愈后的 currentTripId，保证 traveling/hasDelivered 无延迟 */
async function loadMailboxSection(user, active, home, effectiveTripId) {
  const trips = [...active.map((a) => a.trip), ...home];
  const { items } = await collectAndTrimUnread(db, _, user.openid, trips);
  const catalog = await loadPostcardDocMap(items.map((i) => i.postcardId));
  const displayItems = items.map((i) => {
    const doc = catalog.get(i.postcardId);
    if (!doc) return i;
    const snap = normalizePostcardSnapshot(doc);
    return {
      ...i,
      type: snap.type,
      title: doc.title || i.title,
      rarity: doc.rarity || i.rarity,
      imageThumb: snap.imageThumb || i.imageThumb,
      imageFull: snap.imageFull || i.imageFull,
      story: doc.story || i.story,
    };
  });

  const traveling = !!(
    effectiveTripId &&
    trips.some((t) => t._id === effectiveTripId && t.status === 'traveling')
  );
  const currentTrip = trips.find((t) => t._id === effectiveTripId);
  const hasDelivered = !!(
    currentTrip &&
    (currentTrip.postcards || []).some(
      (p) => p.status === 'delivered' || p.status === 'claimed',
    )
  );
  const pigeonState = resolvePigeonState({
    traveling,
    unreadCount: items.length,
    hasDelivered,
  });

  return {
    items: displayItems,
    unreadCount: displayItems.length,
    pigeonState,
    traveling,
    hasDelivered,
    lastMailboxOpenAt: user.lastMailboxOpenAt || 0,
    mailCap: 5,
  };
}

async function syncAll(openid, restartGuide) {
  const starsRes = await syncStars(openid, restartGuide);
  if (!starsRes.ok) return starsRes;
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');
  // login 会话缓存（TTL 12h）命中时冷启动不再调 login，lastLoginAt 改由这里顺带刷新：
  // 距上次写入超过 1h 才 update，控制数据库写成本；写失败不阻断 sync
  const now = Date.now();
  if (!user.lastLoginAt || now - user.lastLoginAt > 3600000) {
    try {
      await db
        .collection('users')
        .doc(user._id)
        .update({ data: { lastLoginAt: now } });
    } catch (e) {
      /* ignore */
    }
  }

  const { active, home } = await loadMailTripsAdvanced(openid);
  const tripSection = await loadTripSection(openid, user, active, home);
  const mailbox = await loadMailboxSection(
    user,
    active,
    home,
    tripSection.currentTripId,
  );

  return ok({
    stars: starsRes.data,
    trip: {
      trip: tripSection.trip,
      delivered: tripSection.delivered,
      souvenirGranted: tripSection.souvenirGranted,
    },
    mailbox,
  });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const { action } = event || {};

    switch (action) {
      case 'sync':
        return await syncStars(OPENID, !!event.restartGuide);
      case 'syncAll':
        return await syncAll(OPENID, !!event.restartGuide);
      case 'collect':
        return await collectStar(OPENID, event.starId);
      case 'collectAll':
        return await collectAllStars(OPENID);
      case 'ping':
        return ok({ service: 'roof', ts: Date.now() });
      default:
        return fail(`未知 action: ${action}`, 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'roof error', e.code || 'ERROR');
  }
};
