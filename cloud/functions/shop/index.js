const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const {
  SHOP_PAGE_SIZE,
  businessDayKey,
} = require('./common/game');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DEFAULT_SHOP_LINES = [
  '今天也要好好挑选行李呀～',
  '这件很适合深深出门用！',
  '星星攒够了再来买也不迟哦。',
  '欢迎光临 coconono！',
  '买了记得放进背包再出发。',
];

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

function mapShopItem(doc, boughtToday) {
  return {
    id: doc.id,
    icon: doc.icon || '',
    price: Number(doc.price) || 0,
    name: doc.name || '',
    description: doc.description || '',
    shopCategory: doc.shopCategory || doc.type || 'food',
    boughtToday: !!boughtToday,
  };
}

async function loadBoughtTodaySet(openid, dayKey) {
  const res = await db
    .collection('daily_purchases')
    .where({ userId: openid, dayKey })
    .get();
  return new Set(res.data.map((d) => d.itemId));
}

async function listItems(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const dayKey = businessDayKey();
  const boughtSet = await loadBoughtTodaySet(openid, dayKey);

  // 商店只卖食物；道具（配饰/装备）仅通过扭蛋获得
  const res = await db
    .collection('items')
    .where({ enabled: true, type: 'food' })
    .orderBy('shopSort', 'asc')
    .limit(200)
    .get();
  const all = (res.data || []).filter((d) => d.price != null && d.price >= 0);
  const pageSize = SHOP_PAGE_SIZE;
  const total = all.length;
  const items = all.map((d) => mapShopItem(d, boughtSet.has(d.id)));

  return ok({
    stars: user.stars || 0,
    tab: 'food',
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    dayKey,
    items,
  });
}

async function findIdempotent(key) {
  const res = await db
    .collection('idempotency')
    .where({ key })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function saveIdempotent(key, result) {
  await db.collection('idempotency').add({
    data: {
      key,
      result,
      createdAt: Date.now(),
    },
  });
}

async function purchase(openid, itemId, requestId) {
  if (!itemId) return fail('缺少 itemId', 'VALIDATION');
  if (!requestId) return fail('缺少 requestId', 'VALIDATION');

  const idemKey = `shop:${openid}:${requestId}`;
  const existed = await findIdempotent(idemKey);
  if (existed) return ok(existed.result);

  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');
  // 教学模式由服务端按完成标志判定（未完成指引前购买即教学购买），不信任客户端入参
  const guideMode = !user.guideCompletedAt;

  const itemRes = await db
    .collection('items')
    .where({ id: itemId, enabled: true })
    .limit(1)
    .get();
  if (!itemRes.data.length) return fail('物品不存在', 'NOT_FOUND');
  const item = itemRes.data[0];
  if (item.type !== 'food') return fail('该物品不在商店出售', 'NOT_FOR_SALE');
  const price = Number(item.price);
  if (!(price >= 0)) return fail('价格无效', 'VALIDATION');

  const dayKey = businessDayKey();
  // 教学购买不占用每日限购额度：不写 daily_purchases（星星照扣、库存照加）。
  // 正式购买先查再插存在并发空窗（两个请求同时过检查、同时插入），
  // 唯一索引 userId+itemId+dayKey 才是可靠的并发闸：先插购买记录，撞唯一索引即今日已购
  if (!guideMode) {
    try {
      await db.collection('daily_purchases').add({
        data: {
          userId: openid,
          itemId,
          dayKey,
          price,
          createdAt: Date.now(),
        },
      });
    } catch (e) {
      if (String((e && e.message) || e).includes('E11000')) {
        return fail('今日已购买该商品', 'DAILY_LIMIT');
      }
      throw e;
    }
  }

  const stars = user.stars || 0;
  if (stars < price) {
    if (!guideMode) {
      // 星星不足：回滚已插入的购买记录，避免占位导致今天无法再购买
      try {
        await db
          .collection('daily_purchases')
          .where({ userId: openid, itemId, dayKey })
          .remove();
      } catch {
        /* 回滚失败不覆盖主错误 */
      }
    }
    return fail('星星不足', 'INSUFFICIENT_STARS');
  }

  let nextStars = stars - price;
  try {
    await db.collection('users').doc(user._id).update({
      data: { stars: nextStars },
    });

    const invRes = await db
      .collection('user_inventory')
      .where({ userId: openid, itemId })
      .limit(1)
      .get();
    if (invRes.data.length) {
      await db.collection('user_inventory').doc(invRes.data[0]._id).update({
        data: {
          count: _.inc(1),
          updatedAt: Date.now(),
          ...(guideMode ? { guide: true } : {}),
        },
      });
    } else {
      await db.collection('user_inventory').add({
        data: {
          userId: openid,
          itemId,
          count: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...(guideMode ? { guide: true } : {}),
        },
      });
    }
  } catch (e) {
    // 扣款/入库失败：回滚已扣星星（教学模式无购买记录，只回滚余额），失败不覆盖主错误
    try {
      if (!guideMode) {
        await db
          .collection('daily_purchases')
          .where({ userId: openid, itemId, dayKey })
          .remove();
      }
      await db.collection('users').doc(user._id).update({
        data: { stars: stars },
      });
    } catch {
      /* ignore */
    }
    throw e;
  }

  const result = {
    itemId,
    price,
    stars: nextStars,
    dayKey,
  };
  try {
    await saveIdempotent(idemKey, result);
  } catch (e) {
    /* 幂等写入失败不回滚购买结果 */
  }
  return ok(result);
}

async function talk() {
  try {
    const res = await db
      .collection('copy_pool')
      .where({ type: 'shop_talk', enabled: true })
      .limit(50)
      .get();
    const pool = (res.data || [])
      .map((d) => d.text)
      .filter((t) => typeof t === 'string' && t.trim());
    const lines = pool.length ? pool : DEFAULT_SHOP_LINES;
    const text = lines[Math.floor(Math.random() * lines.length)];
    return ok({ text });
  } catch (e) {
    const text =
      DEFAULT_SHOP_LINES[Math.floor(Math.random() * DEFAULT_SHOP_LINES.length)];
    return ok({ text });
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid (shop-v2)', 'UNAUTHORIZED');

    const { action } = event || {};
    switch (action) {
      case 'ping':
        return ok({ service: 'shop', ts: Date.now() });
      case 'list':
        return await listItems(OPENID);
      case 'purchase':
        return await purchase(OPENID, event.itemId, event.requestId);
      case 'talk':
        return await talk();
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'shop error', e.code || 'ERROR');
  }
};
