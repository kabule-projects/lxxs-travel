const cloud = require('wx-server-sdk');
const { ok, fail } = require('../common/response');
const { GACHA_COST, GACHA_MULTI, drawBatch } = require('../common/gacha-engine');
const { addInventory } = require('../common/inventory');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

async function findIdempotent(key) {
  const res = await db.collection('idempotency').where({ key }).limit(1).get();
  return res.data[0] || null;
}

async function saveIdempotent(key, result) {
  await db.collection('idempotency').add({
    data: { key, result, createdAt: Date.now() },
  });
}

/** 奖池配置引用 items 集合：名称/图标以 items 为准；只出背包道具（配饰/装备） */
async function loadPool() {
  const res = await db
    .collection('gacha_pool')
    .where({ enabled: true })
    .orderBy('sortOrder', 'asc')
    .limit(200)
    .get();
  const docs = res.data || [];
  if (!docs.length) return [];
  const ids = docs.map((d) => d.itemId || d.gachaId).filter(Boolean);
  const itemRes = await db
    .collection('items')
    .where({ id: _.in(ids), enabled: true })
    .limit(200)
    .get();
  const itemMap = new Map((itemRes.data || []).map((it) => [it.id, it]));
  return docs
    .map((d) => {
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
}

async function loadOwnedSet(openid) {
  const res = await db
    .collection('user_gacha')
    .where({ userId: openid })
    .limit(500)
    .get();
  return new Set((res.data || []).map((d) => d.gachaId));
}

function mapCatalogEntry(d, owned) {
  return {
    gachaId: d.gachaId,
    name: d.name,
    icon: d.icon,
    rarity: d.rarity,
    obtained: owned.has(d.gachaId),
  };
}

async function catalog(openid) {
  const pool = await loadPool();
  const owned = await loadOwnedSet(openid);
  return ok({
    items: pool.map((d) => mapCatalogEntry(d, owned)),
    total: pool.length,
  });
}

async function collection(openid) {
  return catalog(openid);
}

async function draw(openid, count, requestId) {
  const safeCount = count === GACHA_MULTI ? GACHA_MULTI : 1;
  if (!requestId) return fail('缺少 requestId', 'VALIDATION');

  const idemKey = `gacha:${openid}:${requestId}`;
  const existed = await findIdempotent(idemKey);
  if (existed) return ok(existed.result);

  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const totalCost = GACHA_COST * safeCount;
  const stars = user.stars || 0;
  if (stars < totalCost) {
    return fail(
      safeCount > 1 ? '星星不足，无法五连' : '星星不足',
      'INSUFFICIENT_STARS',
    );
  }

  const pool = await loadPool();
  if (!pool.length) return fail('奖池未配置', 'EMPTY_POOL');

  const owned = await loadOwnedSet(openid);
  const batch = drawBatch({
    pool,
    owned: [...owned],
    pity: {
      pitySR: user.pitySR || 0,
      pitySSR: user.pitySSR || 0,
      pityUR: user.pityUR || 0,
    },
    count: safeCount,
  });

  const newStars = stars + batch.starsDelta;
  if (newStars < 0) return fail('星星不足', 'INSUFFICIENT_STARS');

  await db.collection('users').doc(user._id).update({
    data: {
      stars: newStars,
      pitySR: batch.pity.pitySR,
      pitySSR: batch.pity.pitySSR,
      pityUR: batch.pity.pityUR,
    },
  });

  const now = Date.now();
  for (const r of batch.results) {
    if (r.duplicate) continue;
    const found = await db
      .collection('user_gacha')
      .where({ userId: openid, gachaId: r.gachaId })
      .limit(1)
      .get();
    if (!found.data.length) {
      await db.collection('user_gacha').add({
        data: {
          userId: openid,
          gachaId: r.gachaId,
          name: r.name,
          icon: r.icon,
          rarity: r.rarity,
          firstObtainedAt: now,
          count: 1,
        },
      });
    }
    /** 扭蛋产出即背包道具：非消耗品，入 user_inventory 供背包携带 */
    await addInventory(db, _, openid, r.gachaId, 1);
  }

  const result = {
    count: safeCount,
    cost: totalCost,
    stars: newStars,
    results: batch.results,
    pitySR: batch.pity.pitySR,
    pitySSR: batch.pity.pitySSR,
    pityUR: batch.pity.pityUR,
  };
  await saveIdempotent(idemKey, result);
  return ok(result);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const { action } = event || {};
    switch (action) {
      case 'ping':
        return ok({ service: 'gacha', ts: Date.now() });
      case 'catalog':
      case 'collection':
        return await collection(OPENID);
      case 'draw':
        return await draw(OPENID, event.count, event.requestId);
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'gacha error', e.code || 'ERROR');
  }
};
