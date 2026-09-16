/**
 * 展示柜入库（幂等：同 userId+itemId 不重复）
 * 只记录归属关系；name/icon/description 等展示字段读取时联查 items 主表
 * 依赖 user_showcase 的 (userId,itemId) 唯一索引兜底并发重复（如 scheduler 与
 * 前端 sync 同时推进行程重复发伴手礼），撞唯一键视为已拥有
 * @param {DB.Database} db
 * @param {string} userId
 * @param {string} itemId
 * @param {{ source?: string }} [meta]
 */
async function unlockShowcase(db, userId, itemId, meta = {}) {
  if (!userId || !itemId) {
    return { ok: false, reason: 'VALIDATION' };
  }

  const now = Date.now();
  try {
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
  } catch (e) {
    if (e && /duplicate key|E11000/i.test(String(e.errMsg || e.message || e))) {
      return { ok: true, already: true, itemId };
    }
    throw e;
  }
}

/**
 * 展示柜准入唯一标准：items.showcase === true。
 * 不再按 type 回退（accessory 类道具如菜刀不应进展示柜），避免旅行发放/调试解锁误入库。
 */
function isShowcaseItem(item) {
  return !!item && item.showcase === true;
}

module.exports = { unlockShowcase, isShowcaseItem };
