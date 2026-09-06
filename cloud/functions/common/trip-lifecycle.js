const { unlockShowcase } = require('./showcase');
const { addInventory } = require('./inventory');

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
  let returnedNow = false;

  if (status === 'traveling' && now >= trip.endAt) {
    status = 'returned';
    changed = true;
    returnedNow = true;

    if (!souvenirs.length) {
      let pool = [];
      try {
        const destRes = await db
          .collection('destinations')
          .where({ id: trip.destId })
          .limit(1)
          .get();
        pool = (destRes.data[0] && destRes.data[0].souvenirPool) || [];
      } catch (e) {
        pool = [];
      }
      const sid = pickSouvenir(pool);
      if (sid) {
        souvenirs = [sid];
        souvenirGranted = sid;
        await addInventory(db, _, trip.userId, sid, 1);
        await unlockShowcase(db, trip.userId, sid, { source: 'trip' });
      }
    }
  }

  if (changed) {
    await db.collection('trips').doc(tripId).update({
      data: {
        postcards,
        postcardStatus: postcards.map((p) => p.status),
        status,
        souvenirs,
        updatedAt: now,
      },
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
