const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { GACHA_COST, GACHA_MULTI, drawBatch } = require('./common/gacha-engine');
const { addInventory } = require('./common/inventory');

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
  const items = pool.map((d) => mapCatalogEntry(d, owned));
  // 排序：已抽到的在前，未抽到的（问号）在后；组内保持奖池 sortOrder
  items.sort((a, b) => {
    if (a.obtained === b.obtained) return 0;
    return a.obtained ? -1 : 1;
  });
  return ok({ items, total: items.length });
}

/** 我的收藏：读 user_gacha；name/icon 以 items 主表为准，rarity 保留 user_gacha 记录值 */
async function collection(openid) {
  const res = await db
    .collection('user_gacha')
    .where({ userId: openid })
    .limit(500)
    .get();
  const rows = res.data || [];
  const itemMap = await loadItemMap(rows.map((d) => d.gachaId));
  const items = [];
  for (const d of rows) {
    const item = itemMap.get(d.gachaId);
    if (!item) continue; // items 主表缺失的条目跳过
    items.push({
      gachaId: d.gachaId,
      name: item.name || '',
      icon: item.icon || '',
      rarity: d.rarity || 'N',
      firstObtainedAt: d.firstObtainedAt || 0,
      count: d.count || 1,
      obtained: true,
    });
  }
  items.sort((a, b) => (a.firstObtainedAt || 0) - (b.firstObtainedAt || 0));
  return ok({ items, total: items.length });
}

const LOCK_TTL_MS = 60 * 1000;

/**
 * 抢占抽取锁：同一用户同时只允许一个进行中的抽取流程。
 * 锁带 TTL：异常残留（函数超时/崩溃）超过 60s 可被下一次抽取接管，避免永久锁死。
 * @returns {boolean} true=抢到锁
 */
async function acquireDrawLock(user) {
  const now = Date.now();
  const res = await db
    .collection('users')
    .where({ _id: user._id, gachaBusy: null })
    .update({ data: { gachaBusy: now } });
  if (res.stats && res.stats.updated === 1) return true;
  // 未抢到：检查是否残留死锁，超时则接管
  const fresh = await db.collection('users').doc(user._id).get();
  const busyAt = fresh.data && fresh.data.gachaBusy;
  if (typeof busyAt === 'number' && now - busyAt > LOCK_TTL_MS) {
    const steal = await db
      .collection('users')
      .where({ _id: user._id, gachaBusy: busyAt })
      .update({ data: { gachaBusy: now } });
    return !!(steal.stats && steal.stats.updated === 1);
  }
  return false;
}

async function releaseDrawLock(user) {
  try {
    await db.collection('users').doc(user._id).update({ data: { gachaBusy: null } });
  } catch (e) {
    /* 释放失败等 TTL 兜底 */
  }
}

async function draw(openid, count, requestId) {
  const safeCount = count === GACHA_MULTI ? GACHA_MULTI : 1;
  if (!requestId) return fail('缺少 requestId', 'VALIDATION');

  const idemKey = `gacha:${openid}:${requestId}`;
  const existed = await findIdempotent(idemKey);
  if (existed) return ok(existed.result);

  const user = await getUser(openid);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  // 流程锁：上一次抽取没收尾（进行中）时拒绝，保证"一个流程完了才能下一次"
  if (!(await acquireDrawLock(user))) {
    return fail('正在抽取中，请稍候', 'DRAW_IN_PROGRESS');
  }
  try {
    return await doDraw(openid, user, safeCount, idemKey);
  } finally {
    await releaseDrawLock(user);
  }
}

async function doDraw(openid, user, safeCount, idemKey) {
  // 教学模式由服务端按完成标志判定（未完成指引前抽奖即教学抽奖），不信任客户端入参
  const guideMode = !user.guideCompletedAt;

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
          ...(guideMode ? { guide: true } : {}),
        },
      });
    }
    /** 扭蛋产出即背包道具：非消耗品，入 user_inventory 供背包携带 */
    await addInventory(db, _, openid, r.gachaId, 1, guideMode ? { guide: true } : {});
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
        return await catalog(OPENID);
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
