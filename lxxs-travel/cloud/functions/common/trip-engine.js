/**
 * 旅行抽样引擎：目的地 / 时长 / 明信片全部读库权重。
 * 缺省回退与 shared/constants.ts 对齐。
 */

const DEFAULT_TRIP_CFG = {
  distanceMatchMul: 1.4,
  distanceMissMul: 0.4,
  riceDestMul: 1.15,
  ricePostcardMul: 1.25,
  riceRarityMul: { SR: 1.2, SSR: 1.35, UR: 1.5 },
  secondPostcardRate: 0.929,
  riceSecondPostcardBonus: 0,
  deliverAtMinRatio: 0.1,
  deliverAtMaxRatio: 0.9,
  destMatchMul: 1.5,
};

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function uniform(min, max) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function weightedPick(list, scoreFn) {
  if (!list.length) return null;
  let total = 0;
  const scored = list.map((item) => {
    const s = Math.max(0, Number(scoreFn(item)) || 0);
    total += s;
    return { item, s };
  });
  if (total <= 0) {
    return list[Math.floor(Math.random() * list.length)];
  }
  let r = Math.random() * total;
  for (const row of scored) {
    r -= row.s;
    if (r <= 0) return row.item;
  }
  return scored[scored.length - 1].item;
}

function makeInstanceId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function biasMulForGroup(biases, groupId) {
  if (!Array.isArray(biases) || !groupId) return 1;
  let mul = 1;
  for (const b of biases) {
    if (b && b.groupId === groupId && b.weight > 0) mul *= b.weight;
  }
  return mul;
}

function terrainMul(props, tags) {
  let mul = 1;
  const tagSet = Array.isArray(tags) ? tags : [];
  for (const prop of props) {
    const biases = prop.terrainBias || [];
    for (const tag of tagSet) {
      const hit = biases.find((b) => b && b.tag === tag);
      if (hit && hit.weightMul > 0) mul *= hit.weightMul;
    }
  }
  return mul;
}

function propsDestMul(props) {
  let mul = 1;
  for (const prop of props) {
    if (prop.destWeightMul != null && prop.destWeightMul > 0) {
      mul *= prop.destWeightMul;
    }
  }
  return mul;
}

function mergeTripConfig(raw) {
  const cfg = { ...DEFAULT_TRIP_CFG, ...(raw || {}) };
  cfg.riceRarityMul = {
    ...DEFAULT_TRIP_CFG.riceRarityMul,
    ...((raw && raw.riceRarityMul) || {}),
  };
  return cfg;
}

async function loadTripConfig(db) {
  try {
    const res = await db
      .collection('game_config')
      .where({ key: 'trip' })
      .limit(1)
      .get();
    return mergeTripConfig(res.data[0] || null);
  } catch (e) {
    return mergeTripConfig(null);
  }
}

function scoreDestination(dest, food, props, useRice, cfg) {
  let score = Number(dest.baseWeight) || 0;
  if (score <= 0) return 0;

  const dMin = food.distanceMin;
  const dMax = food.distanceMax;
  if (dMin != null && dMax != null && dest.distanceTier != null) {
    if (dest.distanceTier >= dMin && dest.distanceTier <= dMax) {
      score *= cfg.distanceMatchMul;
    } else {
      score *= cfg.distanceMissMul;
    }
  }

  score *= terrainMul(props, dest.terrainTags);
  score *= propsDestMul(props);
  if (useRice) score *= cfg.riceDestMul;
  return score;
}

function pickDestination(destinations, food, props, useRice, cfg) {
  const list = (destinations || []).filter((d) => d && d.enabled !== false);
  if (!list.length) return null;
  return weightedPick(list, (d) => scoreDestination(d, food, props, useRice, cfg));
}

function computeDurationH(food, dest) {
  const fMin = food.durationMinH != null ? Number(food.durationMinH) : 2;
  const fMax = food.durationMaxH != null ? Number(food.durationMaxH) : 8;
  const dMin = dest.durationMinH != null ? Number(dest.durationMinH) : fMin;
  const dMax = dest.durationMaxH != null ? Number(dest.durationMaxH) : fMax;
  const lo = Math.max(fMin, dMin);
  const hi = Math.max(lo, Math.min(fMax, dMax));
  return uniform(lo, hi);
}

function secondPostcardRate(props, useRice, cfg) {
  let rate = Number(cfg.secondPostcardRate);
  for (const prop of props) {
    if (prop.secondPostcardRateBonus != null) {
      rate += Number(prop.secondPostcardRateBonus) || 0;
    }
  }
  if (useRice) rate += Number(cfg.riceSecondPostcardBonus) || 0;
  return clamp01(rate);
}

function scorePostcard(card, food, props, dest, useRice, cfg) {
  let score = Number(card.baseWeight) || 0;
  if (score <= 0) return 0;

  score *= biasMulForGroup(food.postcardBias, card.groupId);
  for (const prop of props) {
    score *= biasMulForGroup(prop.postcardBias, card.groupId);
  }

  if (card.destId && dest && card.destId === dest.id) {
    score *= cfg.destMatchMul;
  }

  if (useRice) {
    score *= cfg.ricePostcardMul;
    const rarMul = cfg.riceRarityMul[card.rarity];
    if (rarMul > 0) score *= rarMul;
  }

  return score;
}

function pickPostcards(pool, count, food, props, dest, useRice, cfg) {
  const available = (pool || []).filter((c) => c && c.enabled !== false);
  const picked = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    const candidates = available.filter((c) => !used.has(c.id));
    if (!candidates.length) break;
    const card = weightedPick(candidates, (c) =>
      scorePostcard(c, food, props, dest, useRice, cfg),
    );
    if (!card) break;
    used.add(card.id);
    picked.push(card);
  }
  return picked;
}

function buildPostcardInstances(cards, startAt, endAt, cfg) {
  const duration = Math.max(1, endAt - startAt);
  const minR = cfg.deliverAtMinRatio;
  const maxR = cfg.deliverAtMaxRatio;
  return cards.map((card) => {
    const ratio = uniform(minR, maxR);
    return {
      instanceId: makeInstanceId('tpm'),
      postcardId: card.id,
      status: 'pending',
      deliverAt: startAt + Math.floor(ratio * duration),
      title: card.title || card.id,
      rarity: card.rarity || 'N',
      groupId: card.groupId || '',
      imageThumb: card.imageThumb || '',
      imageFull: card.imageFull || '',
      story: card.story || '',
    };
  });
}

/**
 * @returns {{ dest, durationH, startAt, endAt, postcards, secondRate, cfg }}
 */
function planTrip({ destinations, postcards, food, props, useRice, cfg, now }) {
  const config = mergeTripConfig(cfg);
  const dest = pickDestination(destinations, food, props, useRice, config);
  if (!dest) {
    const err = new Error('没有可用目的地配置');
    err.code = 'NO_DESTINATION';
    throw err;
  }

  const startAt = now || Date.now();
  const durationH = computeDurationH(food, dest);
  const endAt = startAt + durationH * 3600000;
  const rate = secondPostcardRate(props, useRice, config);
  const count = 1 + (Math.random() < rate ? 1 : 0);
  const cards = pickPostcards(postcards, count, food, props, dest, useRice, config);
  const instances = buildPostcardInstances(cards, startAt, endAt, config);

  return {
    dest,
    durationH,
    startAt,
    endAt,
    secondRate: rate,
    postcardCount: instances.length,
    postcards: instances,
    cfg: config,
  };
}

module.exports = {
  DEFAULT_TRIP_CFG,
  mergeTripConfig,
  loadTripConfig,
  planTrip,
  scoreDestination,
  scorePostcard,
  secondPostcardRate,
  weightedPick,
  makeInstanceId,
};
