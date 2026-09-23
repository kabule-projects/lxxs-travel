const { unlockShowcase, isShowcaseItem } = require('./showcase');
const { addInventory } = require('./inventory');
const { loadFoodPools } = require('./food-trip');

function pickSouvenir(pool) {
  const list = (pool || []).filter(Boolean);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 推进单趟旅行：明信片投递 + 到期归来发伴手礼
 */
async function advanceTrip(db, _, trip, userDoc) {
  const now = Date.now();
  const tripId = trip._id;
  let changed = false;
  const postcards = (trip.postcards || []).map((p) => {
    if (p.status === 'pending' && p.deliverAt <= now) {
      changed = true;
      return { ...p, status: 'delivered', isNew: true };
    }
    return p;
  });

  let status = trip.status;
  let souvenirs = Array.isArray(trip.souvenirs) ? [...trip.souvenirs] : [];
  let souvenirGranted = null;
  // null=本次未发放（不写入文档，避免覆盖历史值）；true=用户首次获得；false=已拥有（重复带回）
  let souvenirNew = null;
  let returnedNow = false;

  if (status === 'traveling' && now >= trip.endAt) {
    status = 'returned';
    changed = true;
    returnedNow = true;

    if (!souvenirs.length) {
      let sid = null;
      if (trip.plan && typeof trip.plan === 'object') {
        // v2 行程：严格按出发时抽样结果发，迷路（souvenirId=null）不发
        sid = trip.plan.souvenirId || null;
      } else {
        // 老行程（无 plan 字段）fallback：按该食物的纪念品行抽（未配置回落全局池）
        try {
          const { config, foods } = await loadFoodPools(db);
          const foodDoc = foods.get(trip.foodId);
          const pool =
            foodDoc &&
            (foodDoc.souvenirBasicPool || []).concat(foodDoc.souvenirRarePool || [])
              .length
              ? (foodDoc.souvenirBasicPool || []).concat(foodDoc.souvenirRarePool || [])
              : (config.souvenirBasicPool || []).concat(config.souvenirRarePool || []);
          sid = pickSouvenir(pool);
        } catch (e) {
          sid = null;
        }
      }
      if (sid) {
        souvenirs = [sid];
        souvenirGranted = sid;
        await addInventory(db, _, trip.userId, sid, 1);
        // 展示柜准入：仅 items.showcase===true 的伴手礼入柜，其余只进背包
        try {
          const itemRes = await db
            .collection('items')
            .where({ id: sid })
            .limit(1)
            .get();
          if (isShowcaseItem(itemRes.data[0])) {
            // 发放前查重：用户已拥有则展示柜不重复入柜（唯一索引兜底并发），
            // 同时记 souvenirNew=false，前端据此不播"带新礼物回家"横幅
            const dup = await db
              .collection('user_showcase')
              .where({ userId: trip.userId, itemId: sid })
              .count()
              .catch(() => null);
            souvenirNew = !dup || !dup.total;
            if (souvenirNew) {
              await unlockShowcase(db, trip.userId, sid, { source: 'trip' });
            }
          } else {
            // 非展示柜物品（只进背包）：不存在"柜内重复"概念，视为新品
            souvenirNew = true;
          }
        } catch (e) {
          /* 查主表失败不阻断行程推进 */
        }
      }
    }
  }

  if (changed) {
    const patch = {
      postcards,
      postcardStatus: postcards.map((p) => p.status),
      status,
      souvenirs,
      updatedAt: now,
    };
    if (souvenirNew !== null) patch.souvenirNew = souvenirNew;
    await db.collection('trips').doc(tripId).update({
      data: patch,
    });
  }

  // 归来瞬间：异步发订阅通知（不 await，失败不影响行程推进）
  // openid 优先取 userDoc；postcard 等调用方传 null 时 trip.userId 即 openid
  if (returnedNow) {
    const openid = (userDoc && userDoc.openid) || trip.userId;
    if (openid) {
      Promise.resolve()
        .then(() => require('./notify').sendTripReturnNotice(openid))
        .catch((e) => console.warn('sendTripReturnNotice fail', e));
    }
  }

  return {
    trip: {
      ...trip,
      _id: tripId,
      postcards,
      status,
      souvenirs,
      // 本次发放的写新值；历史行程沿用文档里已有的值
      souvenirNew: souvenirNew !== null ? souvenirNew : trip.souvenirNew,
    },
    changed,
    souvenirGranted,
    delivered: postcards.filter((p) => p.status === 'delivered'),
  };
}

/**
 * 确认回家：returned → at_home，清空 currentTripId
 */
async function claimHome(db, user, trip) {
  if (!trip) return { ok: false, code: 'NO_TRIP' };
  if (trip.status !== 'returned' && trip.status !== 'at_home') {
    return { ok: false, code: 'NOT_RETURNED' };
  }
  const now = Date.now();
  await db.collection('trips').doc(trip._id).update({
    data: { status: 'at_home', updatedAt: now },
  });
  if (user && user.currentTripId === trip._id) {
    await db.collection('users').doc(user._id).update({
      data: { currentTripId: null },
    });
  }
  return {
    ok: true,
    tripId: trip._id,
    souvenirs: trip.souvenirs || [],
  };
}

module.exports = { advanceTrip, claimHome, pickSouvenir };
