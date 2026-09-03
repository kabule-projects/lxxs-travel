const { PIGEON_MAIL_CAP } = require('./game');

const CAP = PIGEON_MAIL_CAP || 5;

async function upsertDiaryEntry(db, _, openid, card) {
  const album = await db
    .collection('user_postcards')
    .where({ userId: openid, postcardId: card.postcardId })
    .limit(1)
    .get();

  if (!album.data.length) {
    await db.collection('user_postcards').add({
      data: {
        userId: openid,
        postcardId: card.postcardId,
        title: card.title || '明信片',
        rarity: card.rarity || 'N',
        imageThumb: card.imageThumb || '',
        imageFull: card.imageFull || '',
        story: card.story || '',
        firstClaimedAt: Date.now(),
        claimCount: 1,
      },
    });
    return;
  }

  await db.collection('user_postcards').doc(album.data[0]._id).update({
    data: { claimCount: _.inc(1), lastClaimedAt: Date.now() },
  });
}

/** 超容时自动已读：标记 claimed 并写入日记图鉴 */
async function autoReadCard(db, _, openid, trip, card) {
  const list = [...(trip.postcards || [])];
  const idx = list.findIndex((c) => c.instanceId === card.instanceId);
  if (idx < 0) return false;

  list[idx] = {
    ...list[idx],
    status: 'claimed',
    claimedAt: Date.now(),
    isNew: false,
    autoReadAt: Date.now(),
  };
  trip.postcards = list;
  await upsertDiaryEntry(db, _, openid, card);
  return true;
}

/**
 * 收集用户所有未读信（delivered），超容则把最早的自动已读（收下进日记）
 * @returns {{ items: Array, autoReadCount: number }}
 */
async function collectAndTrimUnread(db, _, openid, tripDocs) {
  const unread = [];
  for (const trip of tripDocs) {
    for (const p of trip.postcards || []) {
      if (p.status === 'delivered') {
        unread.push({
          tripId: trip._id,
          trip,
          card: p,
          deliverAt: p.deliverAt || 0,
        });
      }
    }
  }

  unread.sort((a, b) => a.deliverAt - b.deliverAt);
  let autoReadCount = 0;
  const touched = new Map();

  while (unread.length > CAP) {
    const drop = unread.shift();
    const ok = await autoReadCard(db, _, openid, drop.trip, drop.card);
    if (ok) {
      touched.set(drop.tripId, drop.trip);
      autoReadCount += 1;
    }
  }

  for (const [, trip] of touched) {
    await db.collection('trips').doc(trip._id).update({
      data: {
        postcards: trip.postcards,
        postcardStatus: trip.postcards.map((p) => p.status),
        updatedAt: Date.now(),
      },
    });
  }

  const items = unread
    .map((u) => ({
      tripId: u.tripId,
      instanceId: u.card.instanceId,
      postcardId: u.card.postcardId,
      title: u.card.title || '明信片',
      rarity: u.card.rarity || 'N',
      imageThumb: u.card.imageThumb || '',
      imageFull: u.card.imageFull || '',
      story: u.card.story || '',
      deliverAt: u.card.deliverAt || 0,
      isNew: u.card.isNew !== false,
    }))
    .sort((a, b) => b.deliverAt - a.deliverAt);

  return { items, autoReadCount };
}

/** pigeonVisual: away | mail | idle */
function resolvePigeonState({ traveling, unreadCount, lastMailboxOpenAt, newestDeliverAt }) {
  if (traveling && unreadCount === 0) return 'away';
  if (unreadCount > 0) {
    const opened = lastMailboxOpenAt || 0;
    const newest = newestDeliverAt || 0;
    if (newest > opened) return 'mail';
  }
  return 'idle';
}

module.exports = {
  CAP,
  collectAndTrimUnread,
  resolvePigeonState,
};
