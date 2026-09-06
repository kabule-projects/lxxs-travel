const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { assertAdmin } = require('./common/auth');
const { validateItem, validateDestination } = require('./common/validate');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COL = {
  items: 'items',
  destinations: 'destinations',
  manifest: 'asset_manifest',
};

async function listItems() {
  const res = await db.collection(COL.items).orderBy('shopSort', 'asc').get();
  return ok(res.data);
}

async function getItem(id) {
  const res = await db.collection(COL.items).where({ id }).limit(1).get();
  if (!res.data.length) return fail('物品不存在', 'NOT_FOUND');
  return ok(res.data[0]);
}

async function createItem(payload) {
  const doc = validateItem(payload);
  const exists = await db.collection(COL.items).where({ id: doc.id }).count();
  if (exists.total > 0) return fail('id 已存在', 'CONFLICT');
  const now = Date.now();
  const data = {
    ...doc,
    enabled: doc.enabled !== false,
    dailyLimit: 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COL.items).add({ data });
  return ok(data);
}

async function updateItem(id, patch) {
  const res = await db.collection(COL.items).where({ id }).limit(1).get();
  if (!res.data.length) return fail('物品不存在', 'NOT_FOUND');
  const merged = validateItem(res.data[0], { ...patch, id });
  await db.collection(COL.items).doc(res.data[0]._id).update({
    data: { ...merged, updatedAt: Date.now() },
  });
  return ok(merged);
}

async function deleteItem(id) {
  const res = await db.collection(COL.items).where({ id }).limit(1).get();
  if (!res.data.length) return fail('物品不存在', 'NOT_FOUND');
  await db.collection(COL.items).doc(res.data[0]._id).remove();
  return ok({ id });
}

async function listDestinations() {
  const res = await db.collection(COL.destinations).get();
  return ok(res.data);
}

async function createDestination(payload) {
  const doc = validateDestination(payload);
  const exists = await db.collection(COL.destinations).where({ id: doc.id }).count();
  if (exists.total > 0) return fail('id 已存在', 'CONFLICT');
  const now = Date.now();
  const data = {
    ...doc,
    enabled: doc.enabled !== false,
    terrainTags: doc.terrainTags || [],
    souvenirPool: doc.souvenirPool || [],
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COL.destinations).add({ data });
  return ok(data);
}

async function updateDestination(id, patch) {
  const res = await db.collection(COL.destinations).where({ id }).limit(1).get();
  if (!res.data.length) return fail('目的地不存在', 'NOT_FOUND');
  const merged = validateDestination(res.data[0], { ...patch, id });
  await db.collection(COL.destinations).doc(res.data[0]._id).update({
    data: { ...merged, updatedAt: Date.now() },
  });
  return ok(merged);
}

async function deleteDestination(id) {
  const res = await db.collection(COL.destinations).where({ id }).limit(1).get();
  if (!res.data.length) return fail('目的地不存在', 'NOT_FOUND');
  await db.collection(COL.destinations).doc(res.data[0]._id).remove();
  return ok({ id });
}

/** 资源 manifest 列表 */
async function listManifest() {
  const res = await db.collection(COL.manifest).get();
  return ok(res.data);
}

/** 写入 manifest 条目（path 唯一） */
async function upsertManifestEntry(entry) {
  if (!entry.path || !entry.hash) return fail('manifest 需要 path 与 hash', 'VALIDATION');
  const res = await db.collection(COL.manifest).where({ path: entry.path }).limit(1).get();
  const data = {
    path: entry.path,
    hash: entry.hash,
    w: entry.w || 0,
    h: entry.h || 0,
    dpr: entry.dpr || [2, 3],
    updatedAt: Date.now(),
  };
  if (res.data.length) {
    await db.collection(COL.manifest).doc(res.data[0]._id).update({ data });
  } else {
    await db.collection(COL.manifest).add({ data: { ...data, createdAt: Date.now() } });
  }
  return ok(data);
}

async function upsertByField(collection, field, doc) {
  const key = doc[field];
  if (!key) return { skipped: true };
  const res = await db.collection(collection).where({ [field]: key }).limit(1).get();
  const now = Date.now();
  const data = { ...doc, updatedAt: now };
  if (res.data.length) {
    await db.collection(collection).doc(res.data[0]._id).update({ data });
    return { updated: true, id: key };
  }
  await db.collection(collection).add({ data: { ...data, createdAt: now } });
  return { created: true, id: key };
}

/** 导入出行概率目录：game_config / items / destinations / postcards / copy_pool */
async function seedTripCatalog(payload) {
  let catalog = payload && payload.catalog;
  if (!catalog) {
    try {
      catalog = require('./common/seed/trip-catalog.json');
    } catch (e) {
      return fail('缺少 seed 目录 JSON', 'NO_SEED');
    }
  }

  const summary = {
    game_config: 0,
    items: 0,
    destinations: 0,
    postcards: 0,
    copy_pool: 0,
  };

  for (const row of catalog.game_config || []) {
    await upsertByField('game_config', 'key', row);
    summary.game_config += 1;
  }
  for (const row of catalog.items || []) {
    await upsertByField('items', 'id', {
      ...row,
      enabled: row.enabled !== false,
      dailyLimit: 1,
    });
    summary.items += 1;
  }
  for (const row of catalog.destinations || []) {
    await upsertByField('destinations', 'id', {
      ...row,
      enabled: row.enabled !== false,
      terrainTags: row.terrainTags || [],
      souvenirPool: row.souvenirPool || [],
    });
    summary.destinations += 1;
  }
  for (const row of catalog.postcards || []) {
    await upsertByField('postcards', 'id', {
      ...row,
      enabled: row.enabled !== false,
    });
    summary.postcards += 1;
  }
  for (const row of catalog.copy_pool || []) {
    const res = await db
      .collection('copy_pool')
      .where({ type: row.type, text: row.text })
      .limit(1)
      .get();
    if (!res.data.length) {
      await db.collection('copy_pool').add({
        data: { ...row, enabled: row.enabled !== false, createdAt: Date.now() },
      });
    }
    summary.copy_pool += 1;
  }

  return ok({ seeded: true, summary });
}

/** 给指定玩家写入展示柜（幂等），便于云端联调 */
async function grantShowcase(payload) {
  const { unlockShowcase } = require('./common/showcase');
  const openid = payload.openid;
  const itemIds = payload.itemIds || [];
  if (!openid) return fail('缺少 openid', 'VALIDATION');
  if (!itemIds.length) return fail('缺少 itemIds', 'VALIDATION');

  const results = [];
  for (const itemId of itemIds) {
    const res = await unlockShowcase(db, openid, itemId, { source: 'gm' });
    results.push(res);
  }
  return ok({ results });
}

/**
 * 短时签名 URL（占位：需云存储 fileID）
 */
async function getSignedUrl(fileID) {
  if (!fileID) return fail('缺少 fileID', 'VALIDATION');
  try {
    const res = await cloud.getTempFileURL({
      fileList: [{ fileID, maxAge: 900 }],
    });
    const item = res.fileList[0];
    if (item.status !== 0) return fail(item.errMsg || '签名失败', 'STORAGE');
    return ok({ url: item.tempFileURL, expiresIn: 900 });
  } catch (e) {
    return fail(e.message || '签名失败', 'STORAGE');
  }
}

exports.main = async (event) => {
  try {
    const { action, payload = {}, adminSecret } = event;
    assertAdmin(cloud.getWXContext(), adminSecret);

    switch (action) {
      case 'listItems': return await listItems();
      case 'getItem': return await getItem(payload.id);
      case 'createItem': return await createItem(payload);
      case 'updateItem': return await updateItem(payload.id, payload.patch || payload);
      case 'deleteItem': return await deleteItem(payload.id);
      case 'listDestinations': return await listDestinations();
      case 'createDestination': return await createDestination(payload);
      case 'updateDestination': return await updateDestination(payload.id, payload.patch || payload);
      case 'deleteDestination': return await deleteDestination(payload.id);
      case 'listManifest': return await listManifest();
      case 'upsertManifest': return await upsertManifestEntry(payload);
      case 'seedTripCatalog': return await seedTripCatalog(payload);
      case 'grantShowcase': return await grantShowcase(payload);
      case 'getSignedUrl': return await getSignedUrl(payload.fileID);
      case 'ping': return ok({ service: 'admin', ts: Date.now() });
      default: return fail(`未知 action: ${action}`, 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'admin error', e.code || 'ERROR');
  }
};
