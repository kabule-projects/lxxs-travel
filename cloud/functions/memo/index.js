const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { businessDayKey } = require('./common/game');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/** 默认值与 game_config 的 memo 文档同名字段合并（DB 优先），便于不改代码调奖励 */
const DEFAULT_MEMO_CFG = {
  /** 每日首次记录奖励的普通星星数 */
  stars: 6,
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

async function findMemoById(openid, id) {
  const docRes = await db.collection('memos').doc(id).get();
  const doc = docRes.data;
  if (!doc || doc.userId !== openid) return null;
  return doc;
}

/**
 * 每日奖励领取闸：memo_rewards 以 `${userId}_${dateKey}` 为 _id，
 * 利用 _id 唯一性做并发闸——插入成功 = 领到，重复 _id = 今天已领过。
 * @returns {Promise<{stars:number,rice:number}|null>} 领取成功返回奖励，已领/失败返回 null
 */
async function claimDailyReward(openid, dateKey, cfg, user) {
  const rice = Math.random() < cfg.riceStarRate ? cfg.riceStars : 0;
  try {
    await db.collection('memo_rewards').add({
      data: { _id: `${openid}_${dateKey}`, userId: openid, dateKey },
    });
  } catch (e) {
    // 重复 _id = 今日已领；其余错误按已领处理，避免重复发奖
    return null;
  }
  try {
    const patch = { stars: _.inc(cfg.stars) };
    if (rice > 0) patch.riceStars = _.inc(rice);
    await db.collection('users').doc(user._id).update({ data: patch });
    return { stars: cfg.stars, rice };
  } catch (e) {
    // 发奖失败：回收领取凭证，下次保存重试
    try {
      await db.collection('memo_rewards').doc(`${openid}_${dateKey}`).remove();
    } catch (e2) {
      /* ignore */
    }
    return null;
  }
}

function viewOf(doc) {
  return {
    id: doc._id,
    dateKey: doc.dateKey,
    content: doc.content,
    editCount: doc.editCount || 0,
    createdAt: doc.createdAt || 0,
    updatedAt: doc.updatedAt || 0,
  };
}

/** 取一条备忘录（编辑用，按 id）；同时下发奖励配置供前端提示 */
async function getMemo(openid, id) {
  if (!id) return fail('缺少 id', 'VALIDATION');
  const memo = await findMemoById(openid, id);
  if (!memo) return fail('记录不存在', 'NOT_FOUND');
  const cfg = await loadMemoConfig();
  return ok({
    memo: viewOf(memo),
    rewardHint: { stars: cfg.stars, riceStarRate: cfg.riceStarRate },
  });
}

/**
 * 保存：传 id = 编辑既有记录（不限次数，不发奖）；
 * 不传 id = 新建记录（每天可多条；当天第一次新建尝试领取每日奖励，一天一次）。
 */
async function saveMemo(openid, content, id, user) {
  const cfg = await loadMemoConfig();
  if (typeof content !== 'string' || !content.trim()) {
    return fail('内容不能为空', 'VALIDATION');
  }
  if (content.length > cfg.maxLength) {
    return fail(`内容过长（上限 ${cfg.maxLength} 字）`, 'TOO_LONG');
  }
  const now = Date.now();

  if (id) {
    const existing = await findMemoById(openid, id);
    if (!existing) return fail('记录不存在', 'NOT_FOUND');
    await db.collection('memos').doc(id).update({
      data: { content, editCount: _.inc(1), updatedAt: now },
    });
    return ok({
      created: false,
      memo: { ...viewOf(existing), content, editCount: (existing.editCount || 0) + 1, updatedAt: now },
      reward: { stars: 0, rice: 0, grantedNow: false },
    });
  }

  const dateKey = businessDayKey(now);
  const addRes = await db.collection('memos').add({
    data: { userId: openid, dateKey, content, editCount: 0, createdAt: now, updatedAt: now },
  });
  const reward = (await claimDailyReward(openid, dateKey, cfg, user)) || {
    stars: 0,
    rice: 0,
  };
  return ok({
    created: true,
    memo: {
      id: addRes._id,
      dateKey,
      content,
      editCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    reward: { ...reward, grantedNow: reward.stars > 0 },
  });
}

/** 历史列表：同一天可多条，按 dateKey 倒序、同天内 createdAt 倒序分页 */
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
    .orderBy('createdAt', 'desc')
    .skip((p - 1) * ps)
    .limit(ps);
  let rows;
  try {
    rows = (await query.get()).data || [];
  } catch (e) {
    /** 无索引时降级：内存排序分页 */
    const all = await db.collection('memos').where(where).limit(1000).get();
    const sorted = (all.data || []).sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey < a.dateKey ? -1 : 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
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
  const { action, content, id, month, page, pageSize } = event || {};

  const user = await getUser(OPENID);
  if (!user) return fail('用户不存在', 'NOT_FOUND');

  switch (action) {
    case 'get':
      return getMemo(OPENID, id);
    case 'save':
      return saveMemo(OPENID, content, id, user);
    case 'list':
      return listMemos(OPENID, month, page, pageSize);
    default:
      return fail(`未知 action: ${action}`, 'VALIDATION');
  }
};
