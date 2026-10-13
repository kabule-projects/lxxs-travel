const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { unlockShowcase, isShowcaseItem } = require('./common/showcase');
const { SHOP_PAGE_SIZE, businessDayKey } = require('./common/game');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PAGE_SIZE = 8;

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

/** 批量回查 items 主表（batch 20，_.in），返回 id -> 文档 Map */
async function loadItemMap(itemIds) {
  const map = new Map();
  const uniq = [...new Set((itemIds || []).filter(Boolean))];
  if (!uniq.length) return map;

  const batchSize = 20;
  for (let i = 0; i < uniq.length; i += batchSize) {
    const chunk = uniq.slice(i, i + batchSize);
    try {
      const res = await db
        .collection('items')
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

/** 全部展品；前端 4×2=8/页滑动 */
async function listAll(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  let rows = [];
  try {
    const res = await db
      .collection('user_showcase')
      .where({ userId: openid })
      .orderBy('obtainedAt', 'asc')
      .limit(200)
      .get();
    rows = res.data || [];
  } catch (e) {
    /** 无索引时降级 */
    const res = await db
      .collection('user_showcase')
      .where({ userId: openid })
      .limit(200)
      .get();
    rows = (res.data || []).sort(
      (a, b) => (a.obtainedAt || 0) - (b.obtainedAt || 0),
    );
  }

  // 展示字段一律取 items 主表现值；主表缺失或已下架（enabled===false）的条目跳过
  const itemMap = await loadItemMap(rows.map((r) => r.itemId || r._id));
  const items = [];
  for (const row of rows) {
    const itemId = row.itemId || row._id;
    const item = itemMap.get(itemId);
    if (!item || item.enabled === false || !isShowcaseItem(item)) continue;
    items.push({
      id: itemId,
      itemId,
      name: item.name || '',
      icon: item.icon || '',
      description: item.description || '',
      obtainedAt: row.obtainedAt || row.createdAt || 0,
      source: row.source || '',
    });
  }

  return ok({
    pageSize: PAGE_SIZE,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / PAGE_SIZE) || 1),
    items,
  });
}

/** 解锁展品（幂等）；一般由 trip/gacha 内部调用，也允许调试 */
async function unlock(openid, itemId, source) {
  if (!itemId) return fail('缺少 itemId', 'VALIDATION');
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const itemRes = await db
    .collection('items')
    .where({ id: itemId, enabled: true })
    .limit(1)
    .get();
  if (!itemRes.data.length) return fail('物品不存在', 'NOT_FOUND');
  const item = itemRes.data[0];
  if (!isShowcaseItem(item)) {
    return fail('该物品不可放入展示柜', 'NOT_SHOWCASE');
  }

  const res = await unlockShowcase(db, openid, itemId, {
    source: source || 'client',
  });
  return ok(res);
}

/** 调试：把目标用户的所有可展示物品全部解锁（幂等）。
 *  ⚠️ 仅用于本地/测试环境补数据，正式上线前请移除此 action。 */
async function unlockAll(targetOpenid) {
  if (!targetOpenid) return fail('缺少 targetOpenid', 'VALIDATION');
  const user = await getUser(targetOpenid);
  if (!user) return fail('目标用户不存在', 'NOT_FOUND');

  // 拉取 items 主表全部物品，按准入规则过滤（enabled 未显式 false 视为有效）
  const res = await db.collection('items').limit(1000).get();
  const eligible = (res.data || []).filter(
    (it) => it && it.id && it.enabled !== false && isShowcaseItem(it),
  );

  let added = 0;
  let already = 0;
  let failed = 0;
  for (const it of eligible) {
    try {
      const r = await unlockShowcase(db, targetOpenid, it.id, {
        source: 'admin-unlock-all',
      });
      if (r && r.ok) {
        if (r.already) already += 1;
        else added += 1;
      } else {
        failed += 1;
      }
    } catch (e) {
      failed += 1;
    }
  }

  return ok({
    targetOpenid,
    totalEligible: eligible.length,
    added,
    already,
    failed,
  });
}

/** ============ batchGet：一次返回 展示柜+商店+扭蛋图鉴 三个池（loading 预取用） ============
 *  与 shop.list / gacha.catalog 的输出结构保持一致；单段失败只置 null 不影响其他段 */

function mapShopItem(doc) {
  return {
    id: doc.id,
    icon: doc.icon || '',
    price: Number(doc.price) || 0,
    name: doc.name || '',
    description: doc.description || '',
    shopCategory: doc.shopCategory || doc.type || 'food',
    // 每日限购已解除：所有商品可无限重复购买
    boughtToday: false,
  };
}

/** 商店货架段：与 cloud/functions/shop listItems 同逻辑（只卖食物） */
async function loadShopSection(user) {
  const res = await db
    .collection('items')
    .where({ enabled: true, type: 'food' })
    .orderBy('shopSort', 'asc')
    .limit(200)
    .get();
  const all = (res.data || []).filter((d) => d.price != null && d.price >= 0);
  return {
    stars: user.stars || 0,
    tab: 'food',
    pageSize: SHOP_PAGE_SIZE,
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / SHOP_PAGE_SIZE) || 1),
    dayKey: businessDayKey(),
    items: all.map((d) => mapShopItem(d)),
  };
}

/** 扭蛋图鉴段：与 cloud/functions/gacha catalog 同逻辑（跳过券不进目录） */
async function loadGachaSection(openid) {
  const poolRes = await db
    .collection('gacha_pool')
    .where({ enabled: true })
    .orderBy('sortOrder', 'asc')
    .limit(200)
    .get();
  const docs = poolRes.data || [];
  let itemMap = new Map();
  if (docs.length) {
    const ids = docs.map((d) => d.itemId || d.gachaId).filter(Boolean);
    const itemRes = await db
      .collection('items')
      .where({ id: _.in(ids), enabled: true })
      .limit(200)
      .get();
    itemMap = new Map((itemRes.data || []).map((it) => [it.id, it]));
  }
  const ownedRes = await db
    .collection('user_gacha')
    .where({ userId: openid })
    .limit(500)
    .get();
  const owned = new Set((ownedRes.data || []).map((d) => d.gachaId));

  const pool = docs
    .map((d) => {
      if (d.reward === 'skipTicket') {
        return {
          gachaId: 'skip_ticket',
          name: '跳过券',
          icon: '',
          rarity: d.rarity || 'N',
          weight: Number(d.weight) || 1,
          sortOrder: d.sortOrder || 0,
          reward: 'skipTicket',
        };
      }
      const itemId = d.itemId || d.gachaId;
      const item = itemMap.get(itemId);
      if (!item || (item.type !== 'accessory' && item.type !== 'equipment')) {
        return null;
      }
      return {
        gachaId: itemId,
        name: item.name || '',
        icon: item.icon || '',
        rarity: d.rarity || 'N',
        weight: Number(d.weight) || 1,
        sortOrder: d.sortOrder || 0,
      };
    })
    .filter(Boolean);

  const items = pool
    .filter((d) => !d.reward)
    .map((d) => ({
      gachaId: d.gachaId,
      name: d.name,
      icon: d.icon,
      rarity: d.rarity,
      obtained: owned.has(d.gachaId),
    }));
  items.sort((a, b) => {
    if (a.obtained === b.obtained) return 0;
    return a.obtained ? -1 : 1;
  });
  return { items, total: items.length };
}

async function batchGet(openid) {
  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const sections = { showcase: null, shop: null, gacha: null };

  const showcaseRes = await listAll(openid);
  if (showcaseRes && showcaseRes.ok) sections.showcase = showcaseRes.data;

  try {
    sections.shop = await loadShopSection(user);
  } catch (e) {
    sections.shop = null;
  }

  try {
    sections.gacha = await loadGachaSection(openid);
  } catch (e) {
    sections.gacha = null;
  }

  return ok(sections);
}

exports.main = async (event) => {
  try {
    const { action } = event || {};
    const { OPENID } = cloud.getWXContext();
    // 调试 action：控制台「云端测试」无 WXContext，不校验调用者身份，
    // 仅用 event.targetOpenid 操作（上线前随 unlockAll 一并删除）
    if (action === 'unlock-all') {
      return await unlockAll(event.targetOpenid);
    }
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    switch (action) {
      case 'ping':
        return ok({ service: 'showcase', ts: Date.now() });
      case 'list':
        return await listAll(OPENID);
      case 'batchGet':
        return await batchGet(OPENID);
      case 'unlock':
        return await unlock(OPENID, event.itemId, event.source);
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'showcase error', e.code || 'ERROR');
  }
};
