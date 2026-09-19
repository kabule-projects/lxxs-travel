const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { businessDayKey } = require('./common/game');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/** 默认值与 game_config 的 memo 文档同名字段合并（DB 优先），便于不改代码调奖励 */
const DEFAULT_MEMO_CFG = {
  /** 每日首次记录奖励的普通星星数 */
  stars: 5,
  /** 每日首次记录额外获得米子星的概率（0~1） */
  riceStarRate: 0.2,
  /** 中奖时给的米子星个数 */
  riceStars: 1,
  /** 单条备忘录内容长度上限 */
  maxLength: 2000,
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

async function loadMemoConfig() {
  try {
    const res = await db
      .collection('game_config')
      .where({ key: 'memo' })
      .limit(1)
      .get();
    const raw = res.data[0] || {};
    const cfg = { ...DEFAULT_MEMO_CFG };
    for (const k of Object.keys(DEFAULT_MEMO_CFG)) {
      const v = Number(raw[k]);
      if (Number.isFinite(v)) cfg[k] = v;
    }
    cfg.riceStarRate = Math.min(1, Math.max(0, cfg.riceStarRate));
    cfg.maxLength = Math.max(1, Math.floor(cfg.maxLength));
    return cfg;
  } catch (e) {
    return { ...DEFAULT_MEMO_CFG };
  }
}

async function getUser(openid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  return found.data[0] || null;
}

async function findMemo(openid, dateKey) {
  const res = await db
    .collection('memos')
    .where({ userId: openid, dateKey })
    .limit(1)
    .get();
  return res.data[0] || null;
}

/** 发放每日首次记录奖励（普通星星 + 概率米子星） */
async function grantFirstReward(user, cfg) {
  const rice = Math.random() < cfg.riceStarRate ? cfg.riceStars : 0;
  const patch = { stars: _.inc(cfg.stars) };
  if (rice > 0) patch.riceStars = _.inc(rice);
  await db.collection('users').doc(user._id).update({ data: patch });
  return { stars: cfg.stars, rice };
}

function viewOf(doc) {
  return {
    dateKey: doc.dateKey,
    content: doc.content,
    editCount: doc.editCount || 0,
    starsGranted: doc.starsGranted || 0,
    riceGranted: doc.riceGranted || 0,
    createdAt: doc.createdAt || 0,
    updatedAt: doc.updatedAt || 0,
  };
}

/** 取某一天的备忘录（默认今天）；同时下发奖励配置供前端提示 */
async function getMemo(openid, dateKey) {
  const memo = await findMemo(openid, dateKey);
  const cfg = await loadMemoConfig();
  return ok({
    dateKey,
    memo: memo ? viewOf(memo) : null,
    rewardHint: { stars: cfg.stars, riceStarRate: cfg.riceStarRate },
  });
}

/** 首次记录或编辑。首次记录发奖；编辑不限次数不重复发奖。 */
async function saveMemo(openid, content, dateKey, user) {
  const cfg = await loadMemoConfig();
  if (typeof content !== 'string' || !content.trim()) {
    return fail('内容不能为空', 'VALIDATION');
  }
  if (content.length > cfg.maxLength) {
    return fail(`内容过长（上限 ${cfg.maxLength} 字）`, 'TOO_LONG');
  }
  const now = Date.now();
  const existing = await findMemo(openid, dateKey);

  if (existing) {
    // 编辑路径：默认不重复发奖；仅当首次建档后发奖失败（starsGranted 仍为 null）时补发一次
    let reward = { stars: 0, rice: 0, grantedNow: false };
    if (existing.starsGranted == null) {
      const granted = await grantFirstReward(user, cfg);
      reward = { ...granted, grantedNow: true };
    }
    await db
      .collection('memos')
      .doc(existing._id)
      .update({
        data: {
          content,
          editCount: _.inc(1),
          updatedAt: now,
          starsGranted: reward.grantedNow ? reward.stars : existing.starsGranted,
          riceGranted: reward.grantedNow ? reward.rice : existing.riceGranted,
        },
      });
    return ok({
      created: false,
      memo: {
        ...viewOf(existing),
        content,
        editCount: (existing.editCount || 0) + 1,
        updatedAt: now,
        starsGranted: reward.grantedNow ? reward.stars : existing.starsGranted || 0,
        riceGranted: reward.grantedNow ? reward.rice : existing.riceGranted || 0,
      },
      reward,
    });
  }

  // 首次记录：唯一索引 userId+dateKey 是并发闸，撞索引说明并发重复提交，转编辑路径
  try {
    await db.collection('memos').add({
      data: {
        userId: openid,
        dateKey,
        content,
        editCount: 0,
        // 先发奖成功后才会写入实际值；保持 null 以便失败时下次 save 补发
        starsGranted: null,
        riceGranted: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (e) {
    if (String((e && e.message) || '').includes('duplicate key')) {
      return saveMemo(openid, content, dateKey, user);
    }
    throw e;
  }

  let granted = null;
  try {
    granted = await grantFirstReward(user, cfg);
  } catch (e) {
    /* 发奖失败：memos 里 starsGranted 保持 null，用户下次 save 时补发 */
  }
  if (granted) {
    const updated = await findMemo(openid, dateKey);
    if (updated) {
      await db
        .collection('memos')
        .doc(updated._id)
        .update({
          data: { starsGranted: granted.stars, riceGranted: granted.rice },
        });
    }
  }
  return ok({
    created: true,
    memo: {
      dateKey,
      content,
      editCount: 0,
      starsGranted: granted ? granted.stars : null,
      riceGranted: granted ? granted.rice : null,
      createdAt: now,
      updatedAt: now,
    },
    reward: { stars: granted ? granted.stars : 0, rice: granted ? granted.rice : 0, grantedNow: !!granted },
  });
}

/** 历史列表：按 dateKey 倒序分页；传 month('YYYY-MM') 只看某月（日历点用） */
async function listMemos(openid, month, page, pageSize) {
  const where = { userId: openid };
  if (month) {
    if (!MONTH_RE.test(month)) return fail('month 格式应为 YYYY-MM', 'VALIDATION');
    where.dateKey = db.RegExp({ regexp: `^${month}` });
  }
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const ps = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 10)));

  const countRes = await db.collection('memos').where(where).count();
  let query = db
    .collection('memos')
    .where(where)
    .orderBy('dateKey', 'desc')
    .skip((p - 1) * ps)
    .limit(ps);
  let rows;
  try {
    rows = (await query.get()).data || [];
  } catch (e) {
    /** 无索引时降级：内存排序分页 */
    const all = await db.collection('memos').where(where).limit(1000).get();
    const sorted = (all.data || []).sort((a, b) =>
      b.dateKey < a.dateKey ? -1 : b.dateKey > a.dateKey ? 1 : 0,
    );
    rows = sorted.slice((p - 1) * ps, (p - 1) * ps + ps);
  }
  return ok({
    items: rows.map(viewOf),
    total: countRes.total || 0,
    page: p,
    pageSize: ps,
  });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail('未登录', 'UNAUTHORIZED');
  const { action, content, dateKey, month, page, pageSize } = event || {};

  const user = await getUser(OPENID);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  const key = DATE_KEY_RE.test(dateKey || '') ? dateKey : businessDayKey();

  switch (action) {
    case 'get':
      return getMemo(OPENID, key);
    case 'save':
      return saveMemo(OPENID, content, key, user);
    case 'list':
      return listMemos(OPENID, month, page, pageSize);
    default:
      return fail(`未知 action: ${action}`, 'VALIDATION');
  }
};
