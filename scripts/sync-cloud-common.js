/**
 * 上传云函数前运行：node scripts/sync-cloud-common.js
 *
 * 微信云开发上传云函数时只打包该函数自己的目录，不会分析依赖，
 * 因此 cloud/functions/common 共享模块必须物理复制进每个云函数目录，
 * 代码里通过 require('./common/xxx') 引用副本。
 * 本脚本把 common/ 同步到所有函数目录，可重复执行（覆盖式）。
 * 各函数下的 common/ 副本已加入 .gitignore，不要手改。
 */
const fs = require('fs');
const path = require('path');

const functionsRoot = path.join(__dirname, '..', 'cloud', 'functions');
const commonDir = path.join(functionsRoot, 'common');

if (!fs.existsSync(commonDir)) {
  console.error('未找到 cloud/functions/common');
  process.exit(1);
}

const targets = fs
  .readdirSync(functionsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'common')
  .map((d) => d.name)
  .filter((name) => fs.existsSync(path.join(functionsRoot, name, 'index.js')));

for (const name of targets) {
  const dest = path.join(functionsRoot, name, 'common');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(commonDir, dest, { recursive: true });
  console.log(`已同步 common -> ${name}/common`);
}

console.log(`完成，共 ${targets.length} 个云函数。`);
