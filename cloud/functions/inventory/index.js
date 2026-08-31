const cloud = require('wx-server-sdk');
const { ok, fail } = require('../common/response');
const { listInventoryViews } = require('../common/inventory');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const user = await getUser(OPENID);
    if (!user) return fail('用户不存在', 'NOT_FOUND');

    const { action } = event || {};
    switch (action) {
      case 'ping':
        return ok({ service: 'inventory', ts: Date.now() });
      case 'list': {
        const category = event.category || 'all';
        const items = await listInventoryViews(
          db,
          OPENID,
          category === 'all' ? undefined : category,
        );
        return ok({
          stars: user.stars || 0,
          riceStars: user.riceStars || 0,
          items,
        });
      }
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'inventory error', e.code || 'ERROR');
  }
};
