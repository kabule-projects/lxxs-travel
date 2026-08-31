const cloud = require('wx-server-sdk');
const { ok, fail } = require('../common/response');
const { BAG_PROP_SLOTS } = require('../common/game');
const { loadTripConfig, planTrip } = require('../common/trip-engine');
const { advanceTrip, claimHome } = require('../common/trip-lifecycle');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

async function getItem(id) {
  const res = await db
    .collection('items')
    .where({ id, enabled: true })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function loadEnabled(collection, limit = 200) {
  const res = await db
    .collection(collection)
    .where({ enabled: true })
    .limit(limit)
    .get();
  return res.data || [];
}

async function consumeInventory(openid, itemId) {
  const res = await db
    .collection('user_inventory')
    .where({ userId: openid, itemId })
    .limit(1)
    .get();
  if (!res.data.length || (res.data[0].count || 0) < 1) return false;
  const next = (res.data[0].count || 0) - 1;
  if (next <= 0) {
    await db.collection('user_inventory').doc(res.data[0]._id).remove();
  } else {
    await db.collection('user_inventory').doc(res.data[0]._id).update({
      data: { count: next, updatedAt: Date.now() },
    });
  }
  return true;
}

async function startTrip(openid, loadout, requestId) {
  if (!loadout || !loadout.bento) {
    return fail('需要准备食物', 'NEED_FOOD');
  }

  if (requestId) {
    const idemKey = `trip:${openid}:${requestId}`;
    const existed = await db
      .collection('idempotency')
      .where({ key: idemKey })
      .limit(1)
      .get();
    if (existed.data.length) return ok(existed.data[0].result);
  }

  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');
  if (user.currentTripId) {
    return fail('深深正在旅行中', 'ALREADY_TRAVELING');
  }

  const food = await getItem(loadout.bento);
  if (!food || food.type !== 'food') {
    return fail('食物无效', 'INVALID_FOOD');
  }

  const propIds = Array.isArray(loadout.props)
    ? [...new Set(loadout.props.filter(Boolean))].slice(0, BAG_PROP_SLOTS || 2)
    : [];
  const props = [];
  for (const id of propIds) {
    const item = await getItem(id);
    if (!item || (item.type !== 'accessory' && item.type !== 'equipment')) {
      return fail('道具无效', 'INVALID_PROP');
    }
    props.push(item);
  }

  const useRice = !!loadout.riceStar;
  if (useRice && (user.riceStars || 0) < 1) {
    return fail('没有米字星', 'NO_RICE_STAR');
  }

  const [destinations, postcards, cfg] = await Promise.all([
    loadEnabled('destinations'),
    loadEnabled('postcards'),
    loadTripConfig(db),
  ]);

  if (!destinations.length) {
    return fail('目的地未配置，请先导入 seed', 'NO_DESTINATION');
  }
  if (!postcards.length) {
    return fail('明信片未配置，请先导入 seed', 'NO_POSTCARD');
  }

  /** 先校验库存，再抽样，再统一扣除，避免扣了一半失败 */
  const needIds = [loadout.bento, ...propIds];
  for (const id of needIds) {
    const inv = await db
      .collection('user_inventory')
      .where({ userId: openid, itemId: id })
      .limit(1)
      .get();
    if (!inv.data.length || (inv.data[0].count || 0) < 1) {
      return fail('物品库存不足', 'NO_STOCK');
    }
  }

  let plan;
  try {
    plan = planTrip({
      destinations,
      postcards,
      food,
      props,
      useRice,
      cfg,
      now: Date.now(),
    });
  } catch (e) {
    return fail(e.message || '抽样失败', e.code || 'PLAN_FAIL');
  }

  for (const id of needIds) {
    if (!(await consumeInventory(openid, id))) {
      return fail('物品库存不足', 'NO_STOCK');
    }
  }

  const tripDoc = {
    userId: openid,
    status: 'traveling',
    loadout: {
      bento: loadout.bento,
      riceStar: useRice,
      props: propIds,
    },
    destId: plan.dest.id,
    destName: plan.dest.name || plan.dest.id,
    startAt: plan.startAt,
    endAt: plan.endAt,
    durationH: plan.durationH,
    postcards: plan.postcards,
    postcardIds: plan.postcards.map((p) => p.postcardId),
    postcardStatus: plan.postcards.map((p) => p.status),
    souvenirs: [],
    usedRiceStar: useRice,
    secondPostcardRate: plan.secondRate,
    createdAt: plan.startAt,
  };

  const addRes = await db.collection('trips').add({ data: tripDoc });
  await db.collection('users').doc(user._id).update({
    data: { currentTripId: addRes._id },
  });

  const result = {
    tripId: addRes._id,
    destId: plan.dest.id,
    destName: plan.dest.name || plan.dest.id,
    startAt: plan.startAt,
    endAt: plan.endAt,
    durationH: plan.durationH,
    usedRiceStar: useRice,
    postcardCount: plan.postcards.length,
  };

  if (requestId) {
    try {
      await db.collection('idempotency').add({
        data: {
          key: `trip:${openid}:${requestId}`,
          result,
          createdAt: Date.now(),
        },
      });
    } catch (e) {
      /* ignore */
    }
  }

  return ok(result);
}

/** 推进明信片投递 + 到期归来发伴手礼入展示柜 */
async function syncTrip(openid) {
  const user = await getUser(openid);
  if (!user || !user.currentTripId) {
    return ok({ trip: null, delivered: [], souvenirGranted: null });
  }

  const docRes = await db.collection('trips').doc(user.currentTripId).get();
  const trip = docRes.data;
  if (!trip) {
    await db.collection('users').doc(user._id).update({
      data: { currentTripId: null },
    });
    return ok({ trip: null, delivered: [], souvenirGranted: null });
  }

  const advanced = await advanceTrip(
    db,
    _,
    { ...trip, _id: user.currentTripId },
    user,
  );

  return ok({
    trip: advanced.trip,
    delivered: advanced.delivered,
    souvenirGranted: advanced.souvenirGranted,
  });
}

async function currentTrip(openid) {
  return syncTrip(openid);
}

async function doClaimHome(openid) {
  const user = await getUser(openid);
  if (!user || !user.currentTripId) {
    return fail('没有待确认的归来', 'NO_TRIP');
  }
  const docRes = await db.collection('trips').doc(user.currentTripId).get();
  if (!docRes.data) return fail('旅行不存在', 'NOT_FOUND');
  const advanced = await advanceTrip(
    db,
    _,
    { ...docRes.data, _id: user.currentTripId },
    user,
  );
  const res = await claimHome(db, user, advanced.trip);
  if (!res.ok) {
    return fail('深深还在路上', res.code || 'NOT_RETURNED');
  }
  return ok(res);
}

async function farewell() {
  const fallback = [
    '路上小心，记得想我～',
    '去看看外面的世界吧！',
    '带点好吃的回来哦。',
    '深深，一路顺风！',
  ];
  try {
    const res = await db
      .collection('copy_pool')
      .where({ type: 'depart_farewell', enabled: true })
      .limit(50)
      .get();
    const pool = (res.data || [])
      .map((d) => d.text)
      .filter((t) => typeof t === 'string' && t.trim());
    const lines = pool.length ? pool : fallback;
    return ok({ text: lines[Math.floor(Math.random() * lines.length)] });
  } catch (e) {
    return ok({
      text: fallback[Math.floor(Math.random() * fallback.length)],
    });
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const { action } = event || {};
    switch (action) {
      case 'ping':
        return ok({ service: 'trip', ts: Date.now() });
      case 'start':
        return await startTrip(OPENID, event.loadout, event.requestId);
      case 'current':
      case 'sync':
        return await currentTrip(OPENID);
      case 'claimHome':
        return await doClaimHome(OPENID);
      case 'farewell':
        return await farewell();
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'trip error', e.code || 'ERROR');
  }
};
