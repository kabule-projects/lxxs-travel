/**
 * 明信片快照：图片对 + type 等字段归一化。
 * 约定：postcards 配置表为权威来源；user_postcards / trips 内为快照。
 */

const DEFAULT_POSTCARD_TYPE = 'postcard';
const POSTCARD_TYPES = new Set(['postcard', 'letter', 'photo', 'special']);

/** 由主图路径推导默认缩略图路径（主图 + '-thumb'） */
function deriveThumbPath(imageFull) {
  if (!imageFull || typeof imageFull !== 'string') return '';
  if (imageFull.endsWith('-thumb')) return imageFull;
  return `${imageFull}-thumb`;
}

function normalizePostcardType(type) {
  const t = (type || '').trim();
  return POSTCARD_TYPES.has(t) ? t : DEFAULT_POSTCARD_TYPE;
}

/**
 * 归一化图片对；缺 thumb 时按主图推导。
 */
function normalizePostcardImages(source = {}) {
  const imageFull = (source.imageFull || source.image || '').trim();
  let imageThumb = (source.imageThumb || source.thumb || '').trim();
  if (!imageThumb && imageFull) {
    imageThumb = deriveThumbPath(imageFull);
  }
  return { imageThumb, imageFull };
}

/** 归一化完整快照（图片 + type） */
function normalizePostcardSnapshot(source = {}) {
  return {
    ...normalizePostcardImages(source),
    type: normalizePostcardType(source.type),
  };
}

function needsCatalogHydrate(row) {
  const snap = normalizePostcardSnapshot(row);
  const imagesMissing =
    !snap.imageThumb || !snap.imageFull || snap.imageThumb === snap.imageFull;
  const typeMissing = !row.type || row.type === DEFAULT_POSTCARD_TYPE;
  return imagesMissing || (typeMissing && row.postcardId);
}

async function loadPostcardCatalogMap(db, postcardIds) {
  const map = new Map();
  const uniq = [...new Set((postcardIds || []).filter(Boolean))];
  if (!uniq.length) return map;
  const _ = db.command;

  const batchSize = 20;
  for (let i = 0; i < uniq.length; i += batchSize) {
    const chunk = uniq.slice(i, i + batchSize);
    try {
      const res = await db
        .collection('postcards')
        .where({ id: _.in(chunk) })
        .limit(batchSize)
        .get();
      for (const doc of res.data || []) {
        if (doc && doc.id) {
          map.set(doc.id, normalizePostcardSnapshot(doc));
        }
      }
    } catch (e) {
      /* ignore batch failure */
    }
  }
  return map;
}

function mergeFromCatalog(row, fromCatalog) {
  const base = normalizePostcardSnapshot(row);
  if (!fromCatalog) return base;
  return normalizePostcardSnapshot({
    ...base,
    imageFull: base.imageFull || fromCatalog.imageFull,
    imageThumb: base.imageThumb || fromCatalog.imageThumb,
    type: row.type ? base.type : fromCatalog.type,
  });
}

/** 单条：优先快照，缺失时回查 postcards 配置 */
async function hydratePostcardSnapshot(db, row) {
  if (!row) return row;
  const snap = normalizePostcardSnapshot(row);
  if (!needsCatalogHydrate(row)) {
    return { ...row, ...snap };
  }
  if (!row.postcardId) {
    return { ...row, ...snap };
  }
  const catalog = await loadPostcardCatalogMap(db, [row.postcardId]);
  return { ...row, ...mergeFromCatalog(row, catalog.get(row.postcardId)) };
}

/** 批量 hydrate（日记列表等） */
async function hydratePostcardSnapshotList(db, rows) {
  const list = rows || [];
  if (!list.length) return [];

  const needIds = list
    .filter((row) => needsCatalogHydrate(row))
    .map((row) => row.postcardId)
    .filter(Boolean);
  const catalog = await loadPostcardCatalogMap(db, needIds);

  return list.map((row) => {
    if (!needsCatalogHydrate(row)) {
      return { ...row, ...normalizePostcardSnapshot(row) };
    }
    return { ...row, ...mergeFromCatalog(row, catalog.get(row.postcardId)) };
  });
}

module.exports = {
  DEFAULT_POSTCARD_TYPE,
  POSTCARD_TYPES,
  deriveThumbPath,
  normalizePostcardType,
  normalizePostcardImages,
  normalizePostcardSnapshot,
  hydratePostcardSnapshot,
  hydratePostcardSnapshotList,
  needsCatalogHydrate,
  // 兼容旧导出名
  hydratePostcardImages: hydratePostcardSnapshot,
  hydratePostcardImageList: hydratePostcardSnapshotList,
};
