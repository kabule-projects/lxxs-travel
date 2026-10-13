/** 把 seed / import 文件里明信片 story 和 title 的「卡布叻周深/周深」改为「小深」 */
const fs = require('fs');
const path = require('path');

const rename = (s) =>
  typeof s === 'string' ? s.split('卡布叻周深').join('小深').split('周深').join('小深') : s;

let changed = 0;

function renameDoc(doc) {
  let dirty = false;
  for (const field of ['story', 'title']) {
    const next = rename(doc[field]);
    if (next !== doc[field]) { doc[field] = next; dirty = true; }
  }
  if (dirty) changed++;
}

// 1. cloud/seed/trip-catalog.json（JSON）
const seedPath = path.join(__dirname, '../cloud/seed/trip-catalog.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
for (const pc of seed.postcards || []) renameDoc(pc);
fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');

// 2. cloud/functions/common/seed/trip-catalog.json（同步副本）
const commonSeedPath = path.join(__dirname, '../cloud/functions/common/seed/trip-catalog.json');
if (fs.existsSync(commonSeedPath)) {
  const cseed = JSON.parse(fs.readFileSync(commonSeedPath, 'utf8'));
  for (const pc of cseed.postcards || []) renameDoc(pc);
  fs.writeFileSync(commonSeedPath, JSON.stringify(cseed, null, 2) + '\n');
}

// 3. cloud/db/import/jsonl/postcards-18.json（JSONL，逐行）
const jsonlPath = path.join(__dirname, '../cloud/db/import/jsonl/postcards-18.json');
const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n');
const outLines = lines.map((line) => {
  if (!line.trim()) return line;
  const doc = JSON.parse(line);
  renameDoc(doc);
  return JSON.stringify(doc);
});
fs.writeFileSync(jsonlPath, outLines.join('\n'));

console.log(`story/title 更新条数: ${changed}`);
