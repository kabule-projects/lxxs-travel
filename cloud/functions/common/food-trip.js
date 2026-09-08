/**
 * 旅行抽样 v2：food_pools 食物概率体系（目的地已废弃）。
 * 数据约定见 seed/food-pools.json：
 *   kind=food    每种食物一份：lostRate / basicRate / basicPool / rarePool
 *   kind=propBond 道具与专属食物绑定：bondedFood / bondedBonus / otherBonus
 *   kind=config  riceStarBonus / lostPostcardId / souvenirBasicPool / souvenirRarePool
 */

const { weightedPick, makeInstanceId, buildPostcardInstances } = require('./trip-engine');

const SOUVENIR_BASIC_RATE = 0.7;

/** 读 food_pools 全部配置（10 条量级，直接全量） */
async function loadFoodPools(db) {
  const res = await db.collection('food_pools').limit(100).get();
  const foods = new Map();
  const propBonds = new Map();
  let config = {};
  for (const d of res.data || []) {
    if (d.kind === 'food' && d.foodId) foods.set(d.foodId, d);
    else if (d.kind === 'propBond' && d.propId) propBonds.set(d.propId, d);
    else if (d.kind === 'config') config = d;
  }
  return { foods, propBonds, config };
}

/** 不迷路概率 = 1 - lostRate + 道具加成 + 米字星加成，clamp [0,1] */
function computeNoLostRate(foodDoc, config, propBonds, propIds, useRice) {
  let rate = 1 - (Number(foodDoc && foodDoc.lostRate) || 0);
  for (const pid of propIds || []) {
    const bond = propBonds.get(pid);
    if (!bond) continue;
    rate +=
      bond.bondedFood === (foodDoc && foodDoc.foodId)
        ? Number(bond.bondedBonus) || 0
        : Number(bond.otherBonus) || 0;
  }
  if (useRice) rate += Number(config && config.riceStarBonus) || 0;
  if (Number.isNaN(rate)) rate = 0;
  return Math.max(0, Math.min(1, rate));
}

/**
 * 出发时一次性抽样：迷路判定 + 明信片 + 伴手礼
 * @param {object} p
 * @param {object} p.foodPoolDoc kind=food 文档
 * @param {object} p.config kind=config 文档
 * @param {Map<string, object>} p.postcardsById postcards 主表 id -> 文档
 * @param {Map<string, object>} p.propBonds
 * @param {string[]} p.propIds 随行道具 itemId
 * @param {boolean} p.useRice 是否使用米字星
 * @param {number} p.now
 * @returns {{ lost, noLostRate, postcards, souvenirId, durationH, startAt, endAt }}
 */
function planFoodTrip({
  foodPoolDoc,
  config,
  postcardsById,
  propBonds,
  propIds,
  useRice,
  now,
}) {
  const startAt = now || Date.now();
  const noLostRate = computeNoLostRate(foodPoolDoc, config, propBonds, propIds, useRice);
  const lost = Math.random() >= noLostRate;

  const fMin = Number(foodPoolDoc.durationMinH) || 2;
  const fMax = Math.max(fMin, Number(foodPoolDoc.durationMaxH) || 8);
  const durationH = fMin + Math.random() * (fMax - fMin);
  const endAt = startAt + durationH * 3600000;

  // 明信片：迷路 → 全局迷路卡；成功 → 基础/稀有池按 basicRate 抽 1 张
  let cardId = null;
  if (lost) {
    cardId = config.lostPostcardId || null;
  } else {
    const basicRate = Number(foodPoolDoc.basicRate);
    const useBasic = Math.random() < (Number.isNaN(basicRate) ? SOUVENIR_BASIC_RATE : basicRate);
    const pool = useBasic ? foodPoolDoc.basicPool : foodPoolDoc.rarePool;
    const ids = (pool || []).filter((id) => postcardsById.has(id));
    cardId = ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
    // 池子里没可用卡（如土笋冻被加成到不迷路）时回退到全局迷路卡，保证必有明信片
    if (!cardId) cardId = config.lostPostcardId || null;
  }
  const card = cardId ? postcardsById.get(cardId) : null;
  const postcards = card
    ? buildPostcardInstances([card], startAt, endAt, {
        deliverAtMinRatio: 0.1,
        deliverAtMaxRatio: 0.9,
      })
    : [];

  // 伴手礼：仅成功且该食物未标记 noSouvenir 时，基础/稀有 70/30
  let souvenirId = null;
  if (!lost && !foodPoolDoc.noSouvenir) {
    const useBasic = Math.random() < SOUVENIR_BASIC_RATE;
    const pool = useBasic ? config.souvenirBasicPool : config.souvenirRarePool;
    const ids = (pool || []).filter(Boolean);
    souvenirId = ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
  }

  return { lost, noLostRate, postcards, souvenirId, durationH, startAt, endAt };
}

module.exports = { loadFoodPools, computeNoLostRate, planFoodTrip, SOUVENIR_BASIC_RATE };
