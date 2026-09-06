/**
 * 展示柜入库（幂等：同 userId+itemId 不重复）
 * 只记录归属关系；name/icon/description 等展示字段读取时联查 items 主表
 * @param {DB.Database} db
 * @param {string} userId
 * @param {string} itemId
 * @param {{ source?: string }} [meta]
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

  const now = Date.now();
  await db.collection('user_showcase').add({
    data: {
      userId,
      itemId,
      obtainedAt: now,
      source: meta.source || 'system',
      createdAt: now,
    },
  });

  return { ok: true, already: false, itemId };
}

module.exports = { unlockShowcase };
