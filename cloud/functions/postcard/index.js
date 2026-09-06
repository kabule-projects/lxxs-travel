const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { collectAndTrimUnread, resolvePigeonState } = require('./common/mail-box');
const { advanceTrip } = require('./common/trip-lifecycle');
const {
  normalizePostcardSnapshot,
} = require('./common/postcard-images');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

async function loadActiveTrips(openid) {
  const tripsRes = await db
    .collection('trips')
    .where({
      userId: openid,
      status: _.in(['traveling', 'returned']),
    })
    .limit(20)
    .get();

  const trips = [];
  for (const raw of tripsRes.data || []) {
    const advanced = await advanceTrip(
      db,
      _,
      { ...raw, _id: raw._id },
      null,
    );
    trips.push(advanced.trip);
  }
  return trips;
}

async function loadTripForUser(openid, tripId) {
  if (!tripId) return null;
  const res = await db.collection('trips').doc(tripId).get();
  const trip = res.data;
  if (!trip || trip.userId !== openid) return null;
  return { ...trip, _id: tripId };
}

/** 屋顶信箱同步：未读列表 + 鸽子状态 */
async function mailboxSync(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const trips = await loadActiveTrips(openid);
  const { items } = await collectAndTrimUnread(db, _, openid, trips);
  // 展示字段（type/title/rarity/imageThumb/imageFull/story）覆盖为 postcards 主表现值；
  // tripId/instanceId/deliverAt/status 等行程字段仍保留 trips 内嵌快照
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
  const newestDeliverAt = displayItems.reduce(
    (m, i) => Math.max(m, i.deliverAt || 0),
    0,
  );
  const traveling = !!(
    user.currentTripId &&
    trips.some((t) => t._id === user.currentTripId && t.status === 'traveling')
  );

  const pigeonState = resolvePigeonState({
    traveling,
    unreadCount: items.length,
    lastMailboxOpenAt: user.lastMailboxOpenAt || 0,
    newestDeliverAt,
  });

  return ok({
    items: displayItems,
    unreadCount: displayItems.length,
    pigeonState,
    traveling,
    lastMailboxOpenAt: user.lastMailboxOpenAt || 0,
    mailCap: 5,
  });
}

/** 点开信箱：清嘴上的信 */
async function openMailbox(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');
  const now = Date.now();
  await db.collection('users').doc(user._id).update({
    data: { lastMailboxOpenAt: now },
  });
  return mailboxSync(openid);
}

async function markSeen(openid, tripId, instanceId) {
  const trip = await loadTripForUser(openid, tripId);
  if (!trip) return fail('旅行不存在', 'NOT_FOUND');
  const list = [...(trip.postcards || [])];
  const idx = list.findIndex((p) => p.instanceId === instanceId);
  if (idx < 0) return fail('信件不存在', 'NOT_FOUND');
  list[idx] = { ...list[idx], isNew: false };
  await db.collection('trips').doc(trip._id).update({
    data: {
      postcards: list,
      updatedAt: Date.now(),
    },
  });
  return ok({ instanceId, isNew: false });
}

async function claim(openid, tripId, instanceId) {
  if (!tripId || !instanceId) {
    return fail('缺少 tripId 或 instanceId', 'VALIDATION');
  }

  const trip = await loadTripForUser(openid, tripId);
  if (!trip) return fail('旅行不存在', 'NOT_FOUND');

  const advanced = await advanceTrip(db, _, trip, null);
  const idx = (advanced.trip.postcards || []).findIndex(
    (p) => p.instanceId === instanceId,
  );
  if (idx < 0) return fail('明信片不存在', 'NOT_FOUND');
  const card = advanced.trip.postcards[idx];
  if (card.status === 'claimed') {
    return ok({ already: true, postcardId: card.postcardId });
  }
  if (card.status === 'expired') {
    return fail('信件已过期消失', 'EXPIRED');
  }
  if (card.status !== 'delivered') {
    return fail('明信片尚未送达', 'NOT_DELIVERED');
  }

  const next = [...advanced.trip.postcards];
  const snap = normalizePostcardSnapshot(card);
  next[idx] = {
    ...card,
    ...snap,
    status: 'claimed',
    claimedAt: Date.now(),
    isNew: false,
  };
  await db.collection('trips').doc(trip._id).update({
    data: {
      postcards: next,
      postcardStatus: next.map((p) => p.status),
      updatedAt: Date.now(),
    },
  });

  const album = await db
    .collection('user_postcards')
    .where({ userId: openid, postcardId: card.postcardId })
    .limit(1)
    .get();

  let firstUnlock = false;
  if (!album.data.length) {
    firstUnlock = true;
    await db.collection('user_postcards').add({
      data: {
        userId: openid,
        postcardId: card.postcardId,
        firstClaimedAt: Date.now(),
        claimCount: 1,
      },
    });
  } else {
    await db.collection('user_postcards').doc(album.data[0]._id).update({
      data: { claimCount: _.inc(1), lastClaimedAt: Date.now() },
    });
  }

  return ok({
    postcardId: card.postcardId,
    type: snap.type,
    firstUnlock,
    title: card.title,
    rarity: card.rarity,
    imageThumb: snap.imageThumb,
    imageFull: snap.imageFull,
    story: card.story,
  });
}

async function diaryList(openid) {
  const res = await db
    .collection('user_postcards')
    .where({ userId: openid })
    .orderBy('firstClaimedAt', 'asc')
    .limit(200)
    .get();
  const rows = res.data || [];
  // 展示字段一律取 postcards 主表现值；主表缺失的 postcardId 跳过
  const catalog = await loadPostcardDocMap(rows.map((d) => d.postcardId));
  const items = [];
  for (const d of rows) {
    const doc = catalog.get(d.postcardId);
    if (!doc) continue;
    const snap = normalizePostcardSnapshot(doc);
    items.push({
      postcardId: d.postcardId,
      type: snap.type,
      title: doc.title,
      rarity: doc.rarity,
      imageThumb: snap.imageThumb,
      imageFull: snap.imageFull,
      story: doc.story,
      firstClaimedAt: d.firstClaimedAt,
      claimCount: d.claimCount || 1,
    });
  }
  return ok({ items });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const { action } = event || {};
    switch (action) {
      case 'ping':
        return ok({ service: 'postcard', ts: Date.now() });
      case 'mailbox':
      case 'listDelivered':
        return await mailboxSync(OPENID);
      case 'openMailbox':
        return await openMailbox(OPENID);
      case 'markSeen':
        return await markSeen(OPENID, event.tripId, event.instanceId);
      case 'claim':
        return await claim(OPENID, event.tripId, event.instanceId);
      case 'diary':
        return await diaryList(OPENID);
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'postcard error', e.code || 'ERROR');
  }
};
