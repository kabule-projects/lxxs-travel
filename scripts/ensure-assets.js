/**
 * 确保 asset-path.ts 登记的每个路径都有 .webp / @2x / @3x
 * 缺哪档就用现有档位复制填上（不关心画面内容，只保证路径齐全）
 */
const fs = require('fs');
const path = require('path');

const root = path.join('miniprogram', 'assets');
const ts = fs.readFileSync(path.join('miniprogram', 'utils', 'asset-path.ts'), 'utf8');
const expected = [
  ...new Set(
    [...ts.matchAll(/:\s*'([a-z0-9_./-]+)'/g)]
      .map((m) => m[1])
      .filter((v) => v.includes('/')),
  ),
].sort();

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pickSource(base) {
  const candidates = [
    path.join(root, `${base}@3x.webp`),
    path.join(root, `${base}@2x.webp`),
    path.join(root, `${base}.webp`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

let created = 0;
let skipped = 0;
let missingAll = [];

for (const base of expected) {
  const src = pickSource(base);
  const targets = [
    path.join(root, `${base}.webp`),
    path.join(root, `${base}@2x.webp`),
    path.join(root, `${base}@3x.webp`),
  ];
  if (!src) {
    missingAll.push(base);
    continue;
  }
  for (const t of targets) {
    if (fs.existsSync(t)) {
      skipped += 1;
      continue;
    }
    ensureDir(t);
    fs.copyFileSync(src, t);
    created += 1;
    console.log('created', path.relative(root, t), '<-', path.relative(root, src));
  }
}

console.log(JSON.stringify({ expected: expected.length, created, skipped, missingAll }, null, 2));
