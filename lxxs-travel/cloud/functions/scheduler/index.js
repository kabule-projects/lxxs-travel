const cloud = require('wx-server-sdk');
const { ok, fail } = require('../common/response');
const { advanceTrip } = require('../common/trip-lifecycle');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 定时：批量推进 traveling 行程（明信片投递 + 到期归来）
 * 云开发控制台为 scheduler 配置触发器（如每 5 分钟）
 */
exports.main = async () => {
  try {
    const now = Date.now();
    const res = await db
      .collection('trips')
      .where({ status: 'traveling' })
      .limit(100)
      .get();

    let processed = 0;
    let returned = 0;
    let delivered = 0;

    for (const raw of res.data || []) {
      const trip = { ...raw, _id: raw._id };
      const dueMail = (trip.postcards || []).some(
        (p) => p.status === 'pending' && p.deliverAt <= now,
      );
      const dueEnd = trip.endAt <= now;
      if (!dueMail && !dueEnd) continue;

      const userRes = await db
        .collection('users')
        .where({ openid: trip.userId })
        .limit(1)
        .get();
      const user = userRes.data[0] || null;
      const advanced = await advanceTrip(db, _, trip, user);
      processed += 1;
      if (advanced.trip.status === 'returned') returned += 1;
      delivered += (advanced.delivered || []).length;
    }

    return ok({
      service: 'scheduler',
      ts: now,
      processed,
      returned,
      delivered,
    });
  } catch (e) {
    return fail(e.message || 'scheduler error', e.code || 'ERROR');
  }
};
