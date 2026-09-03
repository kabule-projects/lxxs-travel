function assertRange(min, max, label) {
  if (min != null && max != null && min > max) {
    const err = new Error(`${label}: min 不能大于 max`);
    err.code = 'VALIDATION';
    throw err;
  }
}

function validateItem(item, partial) {
  const doc = partial ? { ...item, ...partial } : item;
  if (!doc.id && !partial) {
    const err = new Error('缺少 id');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!doc.type) {
    const err = new Error('缺少 type');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!doc.name) {
    const err = new Error('缺少 name');
    err.code = 'VALIDATION';
    throw err;
  }
  assertRange(doc.durationMinH, doc.durationMaxH, 'duration');
  assertRange(doc.distanceMin, doc.distanceMax, 'distance');
  if (doc.price != null && doc.price < 0) {
    const err = new Error('price 不能为负');
    err.code = 'VALIDATION';
    throw err;
  }
  if (doc.postcardBias) {
    doc.postcardBias.forEach((b) => {
      if (!b.weight || b.weight <= 0) {
        const err = new Error('postcardBias weight 必须 > 0');
        err.code = 'VALIDATION';
        throw err;
      }
    });
  }
  if (doc.terrainBias) {
    doc.terrainBias.forEach((b) => {
      if (!b.weightMul || b.weightMul <= 0) {
        const err = new Error('terrainBias weightMul 必须 > 0');
        err.code = 'VALIDATION';
        throw err;
      }
    });
  }
  if (doc.destWeightMul != null && doc.destWeightMul <= 0) {
    const err = new Error('destWeightMul 必须 > 0');
    err.code = 'VALIDATION';
    throw err;
  }
  return doc;
}

function validateDestination(dest, partial) {
  const doc = partial ? { ...dest, ...partial } : dest;
  if (!doc.id && !partial) {
    const err = new Error('缺少 id');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!doc.name) {
    const err = new Error('缺少 name');
    err.code = 'VALIDATION';
    throw err;
  }
  assertRange(doc.durationMinH, doc.durationMaxH, 'duration');
  if (doc.baseWeight != null && doc.baseWeight <= 0) {
    const err = new Error('baseWeight 必须 > 0');
    err.code = 'VALIDATION';
    throw err;
  }
  return doc;
}

module.exports = { validateItem, validateDestination, assertRange };
