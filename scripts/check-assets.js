const fs = require('fs');
const path = require('path');

const root = 'miniprogram/assets';
const ts = fs.readFileSync('miniprogram/utils/asset-path.ts', 'utf8');
const vals = [...ts.matchAll(/:\s*'([a-z0-9_./-]+)'/g)].map((m) => m[1]);
const expected = [...new Set(vals)]
  .filter((v) => /^[a-z]/.test(v) && v.includes('/'))
  .sort();

function collectBases() {
  const set = new Set();
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.webp')) {
        let rel = path.relative(root, p).split(path.sep).join('/');
        rel = rel.replace(/@(2x|3x)\.webp$/, '').replace(/\.webp$/, '');
        set.add(rel);
      }
    }
  }
  walk(root);
  return set;
}

const on = collectBases();
const missing = expected.filter((e) => !on.has(e));
const extra = [...on].filter((e) => !expected.includes(e)).sort();

console.log('expected', expected.length);
console.log('on_disk', on.size);
console.log('MISSING', missing.length);
missing.forEach((m) => console.log(' -', m));
console.log('EXTRA', extra.length);
extra.forEach((e) => console.log(' +', e));

let dprMiss = [];
for (const e of expected) {
  for (const d of ['2x', '3x']) {
    const p = path.join(root, `${e}@${d}.webp`);
    if (!fs.existsSync(p)) {
      const plain = fs.existsSync(path.join(root, `${e}.webp`));
      dprMiss.push({ e, d, plain });
    }
  }
}
console.log('dpr_miss', dprMiss.length);
dprMiss.forEach((x) => console.log(` - ${x.e}@${x.d}.webp plain=${x.plain}`));
