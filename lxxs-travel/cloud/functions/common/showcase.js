/**
 * 展示柜入库（幂等：同 userId+itemId 不重复）
 * @param {DB.Database} db
 * @param {string} userId
 * @param {string} itemId
 * @param {{ source?: string, name?: string, icon?: string, description?: string }} [meta]
 */
async function unlockShowcase(db, userId, itemId, meta = {}) {
  if (!userId || !itemId) {
    return { ok: false, reason: 'VALIDATION' };
  }

  const existed = await db
    .collection('user_showcase')
    .where({ userId, itemId })
    .limit(1)
    .get();
  if (existed.data.length) {
    return { ok: true, already: true, itemId };
  }

  let name = meta.name || '';
  let icon = meta.icon || '';
  let description = meta.description || '';

  if (!name || !icon || !description) {
    const itemRes = await db
      .collection('items')
      .where({ id: itemId })
      .limit(1)
      .get();
    const item = itemRes.data[0];
    if (item) {
      name = name || item.name || itemId;
      icon = icon || item.icon || '';
      description = description || item.description || '';
    } else {
      name = name || itemId;
    }
  }

  const now = Date.now();
  await db.collection('user_showcase').add({
    data: {
      userId,
      itemId,
      name,
      icon,
      description,
      obtainedAt: now,
      source: meta.source || 'system',
      createdAt: now,
    },
  });

  return { ok: true, already: false, itemId, name };
}

module.exports = { unlockShowcase };
