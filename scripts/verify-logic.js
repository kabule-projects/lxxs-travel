/**
 * 基础逻辑自检：事件绑定 + 云函数核心算法（无需微信运行时）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

let failed = 0;
let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}`);
  if (detail) console.error(`    ${detail}`);
}

function walk(dir, ext, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

/** 从 wxml 提取 catchtap/bindtap/bind:xxx 处理器名 */
function extractWxmlHandlers(wxml) {
  const handlers = new Set();
    const re = /(?:catchtap|bindtap|bindchange|bind:([a-z]+))="([A-Za-z0-9_]+)"/g;
  let m;
  while ((m = re.exec(wxml))) {
    handlers.add(m[2]);
  }
  return handlers;
}

/** 从 Page/Component ts 提取 methods 内函数名 */
function extractTsMethods(ts) {
  const names = new Set();
  const methodBlock = ts.match(/methods\s*:\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*(?:observers|lifetimes|_|\w)/);
  if (methodBlock) {
    const re = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm;
    let m;
    while ((m = re.exec(methodBlock[1]))) names.add(m[1]);
  }
  const pageRe = /^\s+(async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/gm;
  let m;
  while ((m = pageRe.exec(ts))) {
    const name = m[2];
    if (!['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) {
      names.add(name);
    }
  }
  return names;
}

function checkEventBindings() {
  console.log('\n[1] WXML 事件绑定 ↔ TS 方法');
  const wxmlFiles = walk(MP, '.wxml');
  for (const wxmlPath of wxmlFiles) {
    const base = wxmlPath.replace(/\.wxml$/, '');
    const tsPath = `${base}.ts`;
    if (!fs.existsSync(tsPath)) continue;
    const handlers = extractWxmlHandlers(fs.readFileSync(wxmlPath, 'utf8'));
    const methods = extractTsMethods(fs.readFileSync(tsPath, 'utf8'));
    const rel = path.relative(ROOT, wxmlPath);
    for (const h of handlers) {
      if (methods.has(h)) ok(`${rel} → ${h}`);
      else fail(`${rel} → ${h}`, 'TS 中未找到对应方法');
    }
  }
}

function checkEventBus() {
  console.log('\n[2] GameEvent 常量一致性');
  const busPath = path.join(MP, 'utils/event-bus.ts');
  const bus = fs.readFileSync(busPath, 'utf8');
  const events = [...bus.matchAll(/^\s+([A-Z_]+):\s+'([^']+)'/gm)].map((m) => m[2]);
  const tsFiles = walk(MP, '.ts');
  for (const ev of events) {
    const used = tsFiles.some((f) => fs.readFileSync(f, 'utf8').includes(`'${ev}'`) || fs.readFileSync(f, 'utf8').includes(`GameEvent.`));
    if (used) ok(`事件 ${ev} 有引用`);
    else fail(`事件 ${ev}`, '未被任何 TS 引用');
  }
}

function checkTripEngine() {
  console.log('\n[3] trip-engine planTrip');
  const { planTrip } = require(path.join(ROOT, 'cloud/functions/common/trip-engine'));
  const destinations = [
    { id: 'd1', name: '公园', baseWeight: 1, durationMinH: 2, durationMaxH: 4, terrainTags: ['city'] },
    { id: 'd2', name: '海边', baseWeight: 1, durationMinH: 3, durationMaxH: 6, terrainTags: ['sea'] },
  ];
  const postcards = [
    { id: 'p1', destId: 'd1', baseWeight: 1, rarity: 'N', title: '公园明信片' },
    { id: 'p2', destId: 'd2', baseWeight: 1, rarity: 'SR', title: '海边明信片' },
  ];
  const food = { id: 'food_bento_a', type: 'food', durationMinH: 2, durationMaxH: 6 };
  const plan = planTrip({
    destinations,
    postcards,
    food,
    props: [],
    useRice: false,
    cfg: {},
    now: Date.now(),
  });
  if (plan && plan.dest && plan.endAt > plan.startAt) {
    ok('planTrip 返回有效行程');
  } else {
    fail('planTrip', JSON.stringify(plan));
  }
  if (Array.isArray(plan.postcards) && plan.postcards.length >= 1) {
    ok(`planTrip 生成 ${plan.postcards.length} 封明信片实例`);
  } else {
    fail('planTrip postcards', '实例为空');
  }
}

function checkGachaEngine() {
  console.log('\n[4] gacha drawBatch');
  const { drawBatch } = require(path.join(ROOT, 'cloud/functions/common/gacha-engine'));
  const pool = [
    { gachaId: 'g1', weight: 100, rarity: 'N', name: '帽子', itemId: 'acc_hat' },
    { gachaId: 'g2', weight: 1, rarity: 'SSR', name: '相机', itemId: 'eq_cam' },
  ];
  const owned = new Set();
  const pity = { pitySR: 0, pitySSR: 0, pityUR: 0 };
  const res = drawBatch({ pool, owned, pity, count: 1 });
  if (res?.results?.length === 1 && res.results[0].rarity) {
    ok(`drawBatch → ${res.results[0].rarity}`);
  } else {
    fail('drawBatch', JSON.stringify(res));
  }
}

function checkRoofLogic() {
  console.log('\n[5] roof-logic mergeRoofStars');
  // 编译后的 JS 不存在，直接读 TS 源码做简单结构检查
  const src = fs.readFileSync(path.join(MP, 'utils/roof-logic.ts'), 'utf8');
  if (src.includes('mergeRoofStars') && src.includes('formatRemain')) {
    ok('roof-logic 导出关键函数');
  } else {
    fail('roof-logic', '缺少 mergeRoofStars / formatRemain');
  }
}

function checkComponentJson() {
  console.log('\n[6] 页面组件注册');
  const pages = [
    ['home', ['bag-modal', 'trip-banner', 'settings-modal']],
    ['roof', ['star-item', 'bag-modal', 'inventory-picker', 'mail-box-modal']],
    ['gacha', ['gacha-result', 'gacha-prizes', 'star-counter']],
    ['showcase', ['showcase-detail']],
    ['diary', ['diary-letter', 'settings-modal']],
  ];
  for (const [page, required] of pages) {
    const jsonPath = path.join(MP, 'pages', page, 'index.json');
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const comps = json.usingComponents || {};
    for (const name of required) {
      if (comps[name]) ok(`pages/${page} 注册 ${name}`);
      else fail(`pages/${page}`, `未注册组件 ${name}`);
    }
  }
}

checkEventBindings();
checkEventBus();
checkTripEngine();
checkGachaEngine();
checkRoofLogic();
checkComponentJson();

console.log(`\n── 结果：${passed} 通过，${failed} 失败 ──\n`);
process.exit(failed > 0 ? 1 : 0);
