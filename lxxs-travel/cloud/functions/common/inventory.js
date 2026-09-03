/**
 * 背包库存读写
 */

async function getInvDoc(db, userId, itemId) {
  const res = await db
    .collection('user_inventory')
    .where({ userId, itemId })
    .limit(1)
    .get();
  return res.data[0] || null;
}

async function addInventory(db, _, userId, itemId, delta = 1) {
  const cmd = _;
  const doc = await getInvDoc(db, userId, itemId);
  const now = Date.now();
  if (doc) {
    await db.collection('user_inventory').doc(doc._id).update({
      data: { count: cmd.inc(delta), updatedAt: now },
    });
    return { itemId, count: (doc.count || 0) + delta };
  }
  await db.collection('user_inventory').add({
    data: {
      userId,
      itemId,
      count: delta,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { itemId, count: delta };
}

async function listInventory(db, userId) {
  const res = await db
    .collection('user_inventory')
    .where({ userId })
    .limit(200)
    .get();
  return res.data || [];
}

function toCategory(type) {
  if (type === 'food') return 'food';
  if (type === 'accessory' || type === 'equipment') return 'prop';
  return 'other';
}

async function listInventoryViews(db, userId, category) {
  const rows = await listInventory(db, userId);
  const items = [];
  for (const row of rows) {
    if ((row.count || 0) <= 0) continue;
    const itemRes = await db
      .collection('items')
      .where({ id: row.itemId })
      .limit(1)
      .get();
    const item = itemRes.data[0];
    if (!item || item.enabled === false) continue;
    const cat = toCategory(item.type);
    if (category === 'food' && cat !== 'food') continue;
    if (category === 'prop' && cat !== 'prop') continue;
    items.push({
      id: item.id,
      name: item.name || item.id,
      description: item.description || '',
      icon: item.icon || '',
      category: cat === 'other' ? 'prop' : cat,
      type: item.type,
      count: row.count || 0,
    });
  }
  return items;
}

module.exports = {
  addInventory,
  listInventory,
  listInventoryViews,
  getInvDoc,
  toCategory,
};
