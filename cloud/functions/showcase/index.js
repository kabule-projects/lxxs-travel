const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { unlockShowcase } = require('./common/showcase'); 

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PAGE_SIZE = 8;
/** 可放入展示柜的物品类型（与 unlock 的准入规则一致） */
const SHOWCASE_TYPES = ['souvenir', 'accessory', 'equipment'];

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
    if (!item || item.enabled === false) continue;
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
  const canShow =
    item.showcase === true ||
    item.type === 'souvenir' ||
    item.type === 'accessory' ||
    item.type === 'equipment';
  if (!canShow) {
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
    (it) =>
      it &&
      it.id &&
      it.enabled !== false &&
      (it.showcase === true || SHOWCASE_TYPES.includes(it.type)),
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
      case 'unlock':
        return await unlock(OPENID, event.itemId, event.source);
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'showcase error', e.code || 'ERROR');
  }
};
