/** 与 shared/constants.ts 对齐，供云函数使用 */
module.exports = {
  // 旧的时间间隔制参数：仅 resetGuideProgress 初始化 nextSpawnAt 仍用 MIN，其余保留兼容
  STAR_INTERVAL_MIN_MS: 180000,
  STAR_INTERVAL_MAX_MS: 1800000,
  STAR_PENDING_CAP: 5,
  STAR_DROPPED_CAP: 20,
  // 随机节奏生成：到 nextSpawnAt 才生成 1 颗，生成间隔随机 8~40min，同屏总量封顶 STAR_TOTAL_CAP；
  // 新星在天上停留 10min~4h 随机后落地，同屏数量自然涨落，不时刻保持满额
  STAR_TOTAL_CAP: 10,
  STAR_SPAWN_GAP_MIN_MS: 480000,
  STAR_SPAWN_GAP_MAX_MS: 2400000,
  STAR_DROP_MIN_MS: 600000,
  STAR_DROP_MAX_MS: 14400000,
  RICE_STAR_RATE: 0.2,
  SHOP_PAGE_SIZE: 6,
  DAILY_BUY_LIMIT: 1,
  BAG_FOOD_SLOTS: 1,
  BAG_RICE_SLOTS: 1,
  BAG_PROP_SLOTS: 2,
  SHOWCASE_PAGE_SIZE: 8,
  PIGEON_MAIL_CAP: 5,
};

/** 业务日 YYYY-MM-DD（UTC+8 日切） */
function businessDayKey(ts = Date.now()) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const d = new Date(ts + offsetMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function randomInterval(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomSkyPos(index) {
  const cols = [34, 44, 54, 64];
  const rows = [24, 32, 40, 48];
  const col = cols[index % cols.length];
  const row = rows[Math.floor(index / cols.length) % rows.length];
  return {
    skyX: col + Math.random() * 10 - 5,
    skyY: row + Math.random() * 8 - 4,
  };
}

function randomPilePos(index = 0) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    // 与 miniprogram/utils/roof-logic.ts 保持同步（鸽子 right:5%/bottom:24% 的左下角）
    x: 64 + col * 4 + Math.random() * 3 - 1.5,
    y: 73 + row * 1.6 + Math.random() * 2 - 1,
    rotate: Math.floor(Math.random() * 41) - 20,
  };
}

function isRice() {
  return Math.random() < module.exports.RICE_STAR_RATE;
}

module.exports.randomInterval = randomInterval;
module.exports.randomSkyPos = randomSkyPos;
module.exports.randomPilePos = randomPilePos;
module.exports.isRice = isRice;
module.exports.businessDayKey = businessDayKey;
