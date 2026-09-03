/** 扭蛋抽取引擎：保底、权重、重复转星 */

const RARITY_RANK = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };

const GACHA_COST = 5;
const PITY_SR = 10;
const PITY_SSR = 100;
const PITY_UR = 200;

function rankOf(rarity) {
  return RARITY_RANK[rarity] || 1;
}

function pickWeighted(pool, minRarity) {
  const minRank = rankOf(minRarity);
  let eligible = pool.filter((p) => rankOf(p.rarity) >= minRank);
  if (!eligible.length) eligible = pool;
  const total = eligible.reduce((s, p) => s + (Number(p.weight) || 1), 0);
  let roll = Math.random() * total;
  for (const item of eligible) {
    roll -= Number(item.weight) || 1;
    if (roll <= 0) return item;
  }
  return eligible[eligible.length - 1];
}

function resolveMinRarity(pitySR, pitySSR, pityUR) {
  if (pityUR >= PITY_UR) return 'UR';
  if (pitySSR >= PITY_SSR) return 'SSR';
  if (pitySR >= PITY_SR) return 'SR';
  return 'N';
}

function applyPityAfterRoll(pity, rarity) {
  const next = { ...pity };
  if (rankOf(rarity) >= rankOf('SR')) next.pitySR = 0;
  if (rankOf(rarity) >= rankOf('SSR')) next.pitySSR = 0;
  if (rarity === 'UR') next.pityUR = 0;
  return next;
}

function mapResult(entry, duplicate) {
  return {
    gachaId: entry.gachaId,
    name: entry.name || '',
    icon: entry.icon || '',
    rarity: entry.rarity || 'N',
    duplicate: !!duplicate,
  };
}

/**
 * @param {object} opts
 * @param {object[]} opts.pool enabled gacha_pool docs
 * @param {Set<string>} opts.owned gachaId set
 * @param {object} opts.pity { pitySR, pitySSR, pityUR }
 * @param {number} opts.count 1 | 5
 */
function drawBatch({ pool, owned, pity, count }) {
  if (!pool.length) throw new Error('奖池为空');
  const results = [];
  let starsDelta = 0;
  let p = {
    pitySR: pity.pitySR || 0,
    pitySSR: pity.pitySSR || 0,
    pityUR: pity.pityUR || 0,
  };
  const ownedSet = new Set(owned);

  for (let i = 0; i < count; i += 1) {
    starsDelta -= GACHA_COST;
    p.pitySR += 1;
    p.pitySSR += 1;
    p.pityUR += 1;

    const minRarity = resolveMinRarity(p.pitySR, p.pitySSR, p.pityUR);
    const picked = pickWeighted(pool, minRarity);
    p = applyPityAfterRoll(p, picked.rarity);

    const duplicate = ownedSet.has(picked.gachaId);
    if (duplicate) {
      starsDelta += 1;
    } else {
      ownedSet.add(picked.gachaId);
    }
    results.push(mapResult(picked, duplicate));
  }

  return { results, pity: p, starsDelta, owned: [...ownedSet] };
}

module.exports = {
  GACHA_COST,
  GACHA_MULTI: 5,
  drawBatch,
  rankOf,
};
