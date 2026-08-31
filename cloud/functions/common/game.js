/** 与 shared/constants.ts 对齐，供云函数使用 */
module.exports = {
  STAR_INTERVAL_MIN_MS: 600000,
  STAR_INTERVAL_MAX_MS: 7200000,
  STAR_PENDING_CAP: 5,
  STAR_DROPPED_CAP: 20,
  RICE_STAR_RATE: 0.0929,
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
    x: 56 + col * 5 + Math.random() * 4 - 2,
    y: 52 + row * 4 + Math.random() * 3 - 1.5,
    rotate: Math.floor(Math.random() * 41) - 20,
  };
}

function isRice() {
  return Math.random() < 0.0929;
}

module.exports.randomInterval = randomInterval;
module.exports.randomSkyPos = randomSkyPos;
module.exports.randomPilePos = randomPilePos;
module.exports.isRice = isRice;
module.exports.businessDayKey = businessDayKey;
