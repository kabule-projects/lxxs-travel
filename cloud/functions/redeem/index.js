const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { addInventory } = require('./common/inventory');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/** 兑换码归一化：去空格 + 大写，避免大小写/首尾空格造成"不存在" */
function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

/** 展开奖励：item 直发；set 查 redeem_sets 展开为物品列表；stars/riceStars 为货币 */
async function buildRewardPlan(rewards) {
  const plan = { items: [], stars: 0, riceStars: 0 };
  const list = Array.isArray(rewards) ? rewards : [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    if (r.type === 'stars') {
      plan.stars += Math.max(0, Number(r.count) || 0);
    } else if (r.type === 'riceStars') {
      plan.riceStars += Math.max(0, Number(r.count) || 0);
    } else if (r.type === 'item' && r.itemId) {
      plan.items.push({ itemId: String(r.itemId), count: Math.max(1, Number(r.count) || 1) });
    } else if (r.type === 'set' && r.setId) {
      const setRes = await db
        .collection('redeem_sets')
        .where({ setId: String(r.setId), active: true })
        .limit(1)
        .get();
      const setDoc = setRes.data[0];
      const items = Array.isArray(setDoc && setDoc.items) ? setDoc.items : [];
      for (const it of items) {
        if (!it || !it.itemId) continue;
        plan.items.push({ itemId: String(it.itemId), count: Math.max(1, Number(it.count) || 1) });
      }
    }
  }
  return plan;
}

async function exchange(openid, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return fail('请输入兑换码', 'VALIDATION');

  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const codeRes = await db
    .collection('redeem_codes')
    .where({ code })
    .limit(1)
    .get();
  const codeDoc = codeRes.data[0];
  if (!codeDoc || codeDoc.active === false) {
    return fail('兑换码不存在', 'NOT_FOUND_CODE');
  }
  const now = Date.now();
  if (codeDoc.validFrom && now < Number(codeDoc.validFrom)) {
    return fail('兑换码不存在', 'NOT_FOUND_CODE');
  }
  if (codeDoc.validUntil && now > Number(codeDoc.validUntil)) {
    return fail('兑换码已过期', 'EXPIRED');
  }
  const maxUses = Number(codeDoc.maxUses) || 0;
  if (maxUses > 0 && (Number(codeDoc.usedCount) || 0) >= maxUses) {
    return fail('兑换码已兑完', 'EXHAUSTED');
  }

  const plan = await buildRewardPlan(codeDoc.rewards);

  // 先插兑换记录占位：唯一索引 userId+code 是"一人一码一次"的并发闸，
  // 撞 E11000 即已兑换
  const recordData = {
    userId: openid,
    code,
    rewards: plan,
    usedAt: now,
  };
  try {
    await db.collection('redeem_records').add({ data: recordData });
  } catch (e) {
    if (String((e && e.message) || e).includes('E11000')) {
      return fail('该兑换码已兑换', 'ALREADY_USED');
    }
    throw e;
  }

  try {
    // 发放奖励
    const currencyPatch = {};
    if (plan.stars > 0) currencyPatch.stars = _.inc(plan.stars);
    if (plan.riceStars > 0) currencyPatch.riceStars = _.inc(plan.riceStars);
    if (Object.keys(currencyPatch).length) {
      await db.collection('users').doc(user._id).update({ data: currencyPatch });
    }
    const grantedItems = [];
    for (const it of plan.items) {
      // 只发存在的启用物品，配置错误的 itemId 静默跳过
      const itemRes = await db
        .collection('items')
        .where({ id: it.itemId })
        .limit(1)
        .get();
      const itemDoc = itemRes.data[0];
      if (!itemDoc || itemDoc.enabled === false) continue;
      const r = await addInventory(db, _, openid, it.itemId, it.count);
      grantedItems.push({
        itemId: it.itemId,
        name: itemDoc.name || it.itemId,
        icon: itemDoc.icon || '',
        count: r.count,
      });
    }
    await db.collection('redeem_codes').doc(codeDoc._id).update({
      data: { usedCount: _.inc(1) },
    });

    return ok({
      code,
      stars: plan.stars,
      riceStars: plan.riceStars,
      items: grantedItems,
    });
  } catch (e) {
    // 发放失败：回滚兑换记录，避免占位导致用户永远无法再兑
    try {
      await db
        .collection('redeem_records')
        .where({ userId: openid, code })
        .remove();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid (redeem)', 'UNAUTHORIZED');

    const { action } = event || {};
    switch (action) {
      case 'ping':
        return ok({ service: 'redeem', ts: Date.now() });
      case 'exchange':
        return await exchange(OPENID, event.code);
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'redeem error', e.code || 'ERROR');
  }
};
