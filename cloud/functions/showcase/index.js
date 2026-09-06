const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { unlockShowcase } = require('./common/showcase');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const PAGE_SIZE = 8;

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

function mapRow(row) {
  return {
    id: row.itemId || row._id,
    itemId: row.itemId || row._id,
    name: row.name || '',
    icon: row.icon || '',
    description: row.description || '',
    obtainedAt: row.obtainedAt || row.createdAt || 0,
    source: row.source || '',
  };
}

async function hydrate(row) {
  const base = mapRow(row);
  if (base.name && base.description) return base;
  try {
    const itemRes = await db
      .collection('items')
      .where({ id: base.itemId })
      .limit(1)
      .get();
    const item = itemRes.data[0];
    if (item) {
      return {
        ...base,
        name: base.name || item.name || base.itemId,
        icon: base.icon || item.icon || '',
        description: base.description || item.description || '',
      };
    }
  } catch (e) {
    /* ignore */
  }
  return base;
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

  const items = [];
  for (const row of rows) {
    items.push(await hydrate(row));
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
    name: item.name,
    icon: item.icon,
    description: item.description,
  });
  return ok(res);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');
    const { action } = event || {};
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
