const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { assertGm } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function audit(gmOpenid, action, payload) {
  await db.collection('gm_audit').add({
    data: {
      gmOpenid,
      action,
      payload,
      at: Date.now(),
    },
  });
}

async function getUser(payload) {
  const { openid } = payload;
  if (!openid) return fail('缺少 openid', 'VALIDATION');
  const res = await db.collection('users').where({ openid }).limit(1).get();
  if (!res.data.length) return fail('用户不存在', 'NOT_FOUND');
  return ok(res.data[0]);
}

async function setStars(gmOpenid, payload) {
  const { openid, stars } = payload;
  if (!openid || stars == null || stars < 0) return fail('参数无效', 'VALIDATION');
  const res = await db.collection('users').where({ openid }).limit(1).get();
  if (!res.data.length) return fail('用户不存在', 'NOT_FOUND');
  await db.collection('users').doc(res.data[0]._id).update({ data: { stars } });
  await audit(gmOpenid, 'setStars', { openid, stars });
  return ok({ openid, stars });
}

async function setPity(gmOpenid, payload) {
  const { openid, pitySR, pitySSR, pityUR } = payload;
  if (!openid) return fail('缺少 openid', 'VALIDATION');
  const res = await db.collection('users').where({ openid }).limit(1).get();
  if (!res.data.length) return fail('用户不存在', 'NOT_FOUND');
  const patch = {};
  if (pitySR != null) patch.pitySR = pitySR;
  if (pitySSR != null) patch.pitySSR = pitySSR;
  if (pityUR != null) patch.pityUR = pityUR;
  await db.collection('users').doc(res.data[0]._id).update({ data: patch });
  await audit(gmOpenid, 'setPity', { openid, ...patch });
  return ok({ openid, ...patch });
}

async function endTrip(gmOpenid, payload) {
  const { tripId } = payload;
  if (!tripId) return fail('缺少 tripId', 'VALIDATION');
  const res = await db.collection('trips').doc(tripId).get();
  if (!res.data) return fail('旅行不存在', 'NOT_FOUND');
  const trip = res.data;
  if (trip.status !== 'traveling') return fail('旅行未在进行中', 'BAD_STATE');
  const now = Date.now();
  await db.collection('trips').doc(tripId).update({
    data: { status: 'returned', endAt: now, gmEnded: true },
  });
  await audit(gmOpenid, 'endTrip', { tripId, userId: trip.userId });
  return ok({ tripId, status: 'returned' });
}

exports.main = async (event) => {
  try {
    const gmOpenid = assertGm(cloud.getWXContext());
    const { action, payload = {} } = event;

    switch (action) {
      case 'getUser': return await getUser(payload);
      case 'setStars': return await setStars(gmOpenid, payload);
      case 'setPity': return await setPity(gmOpenid, payload);
      case 'endTrip': return await endTrip(gmOpenid, payload);
      case 'ping': return ok({ service: 'gm', gmOpenid, ts: Date.now() });
      default: return fail(`未知 action: ${action}`, 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'gm error', e.code || 'ERROR');
  }
};
