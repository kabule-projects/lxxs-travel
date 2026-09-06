const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/** V1：奖池无服装，固定空态 */
async function listOutfits(openid) {
  try {
    const res = await db
      .collection('user_outfits')
      .where({ userId: openid })
      .limit(100)
      .get();
    const items = (res.data || []).map((d) => ({
      outfitId: d.outfitId,
      name: d.name || d.outfitId,
      icon: d.icon || '',
      equipped: !!d.equipped,
      obtainedAt: d.obtainedAt || 0,
    }));
    return ok({
      empty: items.length === 0,
      message: items.length ? '' : '衣柜还是空的，扭蛋服装将在后续版本出现',
      items,
    });
  } catch (e) {
    return ok({
      empty: true,
      message: '衣柜还是空的，扭蛋服装将在后续版本出现',
      items: [],
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
        return ok({ service: 'wardrobe', ts: Date.now() });
      case 'list':
        return await listOutfits(OPENID);
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'wardrobe error', e.code || 'ERROR');
  }
};
