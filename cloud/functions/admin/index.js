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

/** 废卡清单（postcard-N.webp → pc_N）：不入图鉴，removeIncompleteCards 负责清除 */
const WASTE_POSTCARD_IDS = [
  30, 35, 37, 39, 40, 48, 52, 57, 58, 59, 65, 68, 69, 70, 79, 80, 82, 83, 87, 88,
  94, 95, 99, 100, 102, 103, 105, 106, 107, 112, 113, 117, 132, 134, 141, 142, 143,
  144, 145, 146, 147, 148, 149, 150, 151, 152, 154, 155, 156, 158, 161, 163,
].map((n) => `pc_${n}`);

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
 * 一次性数据迁移：明信片文案去「周深」。
 * 把 postcards 主表 story/title、trips 集合内明信片快照 story/title 中的
 * 「卡布叻周深」→「小深」（残余的单独「周深」同样替换为「小深」）。
 * user_postcards 只存 id/次数，展示字段读取时联查主表，无需处理。
 */
async function migratePostcardNames() {
  const rename = (s) => {
    if (typeof s !== 'string' || !s.includes('周深')) return { text: s, changed: false };
    const text = s.split('卡布叻周深').join('小深').split('周深').join('小深');
    return { text, changed: text !== s };
  };

  // 主表 postcards（并行更新）
  const pcs = await db.collection('postcards').limit(1000).get();
  const pcTasks = [];
  for (const doc of pcs.data || []) {
    const story = rename(doc.story);
    const title = rename(doc.title);
    if (!story.changed && !title.changed) continue;
    const data = { updatedAt: Date.now() };
    if (story.changed) data.story = story.text;
    if (title.changed) data.title = title.text;
    pcTasks.push(db.collection('postcards').doc(doc._id).update({ data }));
  }
  await Promise.all(pcTasks);
  const postcardsUpdated = pcTasks.length;

  // trips 快照（分页扫全表）
  const PAGE = 100;
  let skip = 0;
  let tripsScanned = 0;
  let tripsUpdated = 0;
  for (;;) {
    const res = await db.collection('trips').skip(skip).limit(PAGE).get();
    const list = res.data || [];
    if (!list.length) break;
    const pageTasks = [];
    for (const trip of list) {
      tripsScanned += 1;
      const cards = trip.postcards || [];
      let dirty = false;
      const nextCards = cards.map((c) => {
        const story = rename(c && c.story);
        const title = rename(c && c.title);
        if (story.changed || title.changed) {
          dirty = true;
          return {
            ...c,
            ...(story.changed ? { story: story.text } : {}),
            ...(title.changed ? { title: title.text } : {}),
          };
        }
        return c;
      });
      if (dirty) {
        tripsUpdated += 1;
        pageTasks.push(
          db.collection('trips').doc(trip._id).update({
            data: { postcards: nextCards, updatedAt: Date.now() },
          }),
        );
      }
    }
    await Promise.all(pageTasks);
    skip += list.length;
    if (list.length < PAGE) break;
  }

  return ok({ postcardsUpdated, tripsScanned, tripsUpdated });
}

/** 给指定用户补录全部现存明信片图鉴（user_postcards），排除废卡。
 *  已有条目不覆盖 claimCount；幂等，重复执行安全。 */
async function grantAllPostcards(payload) {
  const openid = payload.openid;
  if (!openid) return fail('缺少 openid', 'VALIDATION');
  const user = await db.collection('users').where({ openid }).limit(1).get();
  if (!user.data.length) return fail('用户不存在', 'NOT_FOUND');

  const pcs = await db.collection('postcards').limit(1000).get();
  const list = (pcs.data || []).filter((pc) => !WASTE_POSTCARD_IDS.includes(pc.id));
  const now = Date.now();

  // 先并行查已有图鉴，再并行补缺失
  const founds = await Promise.all(
    list.map((pc) =>
      db.collection('user_postcards').where({ userId: openid, postcardId: pc.id }).limit(1).get(),
    ),
  );
  let existed = 0;
  const adds = [];
  for (let i = 0; i < list.length; i += 1) {
    if (founds[i].data.length) {
      existed += 1;
      continue;
    }
    adds.push(
      db.collection('user_postcards').add({
        data: { userId: openid, postcardId: list[i].id, firstClaimedAt: now, claimCount: 1 },
      }),
    );
  }
  await Promise.all(adds);
  return ok({ total: list.length, granted: adds.length, existed });
}

/** 清除废卡：删 postcards 主表条目 + 所有用户 user_postcards 图鉴条目。幂等。 */
async function removeIncompleteCards() {
  const pcRes = await db
    .collection('postcards')
    .where({ id: _.in(WASTE_POSTCARD_IDS) })
    .remove();
  const upRes = await db
    .collection('user_postcards')
    .where({ postcardId: _.in(WASTE_POSTCARD_IDS) })
    .remove();
  return ok({
    postcardsRemoved: (pcRes.stats && pcRes.stats.removed) || 0,
    userPostcardsRemoved: (upRes.stats && upRes.stats.removed) || 0,
  });
}

/**
 * 批量把指定 userId 的 stars 覆盖为目标值。
 * payload: { items: [{ userId: string, stars: number }] }
 * 以 userId（非 _id）定位；逐个返回 prevStars 便于回读确认；非法/缺失分别汇总。
 */
async function setUserStars(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return fail('缺少 items', 'VALIDATION');

  const results = [];
  const tasks = [];
  for (const it of items) {
    const userId = it && it.userId;
    const stars = it && it.stars;
    if (typeof userId !== 'string' || !userId) {
      results.push({ userId: userId || null, status: 'invalid', reason: 'bad userId' });
      continue;
    }
    if (typeof stars !== 'number' || !Number.isFinite(stars) || stars < 0) {
      results.push({ userId, status: 'invalid', reason: 'bad stars' });
      continue;
    }
    tasks.push(
      (async () => {
        const res = await db.collection('users').where({ userId }).limit(1).get();
        const user = (res.data || [])[0];
        if (!user) {
          results.push({ userId, status: 'notFound' });
          return;
        }
        await db
          .collection('users')
          .doc(user._id)
          .update({ data: { stars, updatedAt: Date.now() } });
        results.push({
          userId,
          _id: user._id,
          status: 'updated',
          prevStars: user.stars || 0,
          stars,
        });
      })(),
    );
  }
  await Promise.all(tasks);

  return ok({
    total: items.length,
    updated: results.filter((r) => r.status === 'updated').length,
    notFound: results.filter((r) => r.status === 'notFound').map((r) => r.userId),
    invalid: results.filter((r) => r.status === 'invalid').map((r) => r.userId),
    results,
  });
}

/**
 * 合并重复明信片（图片重复的两张卡）：按 userId 分组处理。
 * payload: { fromId: 'pc_15', toId: 'pc_49' }
 *  - 用户仅有 fromId → 把该记录 postcardId 改为 toId（保留 claimCount/firstClaimedAt）
 *  - 用户同时拥有 fromId 和 toId → 删除其全部 fromId 记录（toId 不动）
 *  - 仅有 toId / 都没有 → 不动
 * 异常兜底：某用户 fromId 多于一条（违背每用户每卡一条的写入约定）且无 toId 时，
 * 第一条改写为 toId、多余删除并记入 anomalies。可重复执行（幂等）。
 */
async function mergeDuplicatePostcards(payload) {
  const fromId = payload && payload.fromId;
  const toId = payload && payload.toId;
  if (typeof fromId !== 'string' || !fromId || typeof toId !== 'string' || !toId) {
    return fail('缺少 fromId / toId', 'VALIDATION');
  }
  if (fromId === toId) return fail('fromId 与 toId 不能相同', 'VALIDATION');

  // 分页拉取全部 fromId / toId 记录
  const records = [];
  const PAGE = 100;
  for (let skip = 0; ; skip += PAGE) {
    const res = await db
      .collection('user_postcards')
      .where({ postcardId: _.in([fromId, toId]) })
      .skip(skip)
      .limit(PAGE)
      .get();
    const batch = res.data || [];
    records.push(...batch);
    if (batch.length < PAGE) break;
  }

  // 按 userId 分组
  const byUser = new Map();
  for (const r of records) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, { from: [], to: [] });
    const bucket = byUser.get(r.userId);
    if (r.postcardId === fromId) bucket.from.push(r);
    else bucket.to.push(r);
  }

  const summary = {
    replaced: 0,
    deleted: 0,
    usersTouched: 0,
    anomalies: [],
    errors: [],
  };
  const tasks = [];
  for (const [userId, bucket] of byUser) {
    if (!bucket.from.length) continue; // 仅 toId：不动
    tasks.push(
      (async () => {
        try {
          if (bucket.to.length) {
            // 两者都有：删除全部 fromId
            for (const rec of bucket.from) {
              await db.collection('user_postcards').doc(rec._id).remove();
              summary.deleted += 1;
            }
          } else {
            // 仅 fromId：第一条改写，多余（异常）删除
            await db.collection('user_postcards').doc(bucket.from[0]._id).update({
              data: { postcardId: toId, updatedAt: Date.now() },
            });
            summary.replaced += 1;
            for (const rec of bucket.from.slice(1)) {
              await db.collection('user_postcards').doc(rec._id).remove();
              summary.deleted += 1;
              summary.anomalies.push({ userId, extraFromId: rec._id });
            }
          }
          summary.usersTouched += 1;
        } catch (e) {
          summary.errors.push({ userId, message: e && e.message });
        }
      })(),
    );
  }
  await Promise.all(tasks);

  return ok({
    fromId,
    toId,
    scanned: records.length,
    users: byUser.size,
    ...summary,
  });
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
      case 'migratePostcardNames': return await migratePostcardNames();
      case 'grantAllPostcards': return await grantAllPostcards(payload);
      case 'removeIncompleteCards': return await removeIncompleteCards();
      case 'setUserStars': return await setUserStars(payload);
      case 'mergeDuplicatePostcards': return await mergeDuplicatePostcards(payload);
      case 'getSignedUrl': return await getSignedUrl(payload.fileID);
      case 'ping': return ok({ service: 'admin', ts: Date.now() });
      default: return fail(`未知 action: ${action}`, 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'admin error', e.code || 'ERROR');
  }
};
