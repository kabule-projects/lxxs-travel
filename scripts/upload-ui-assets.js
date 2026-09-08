const fs = require('fs');
const path = require('path');

// 把 miniprogram/assets 下的媒体文件（webp/aac）原样暂存到 .cdn-staging/ui/，
// 再用 cloudbase CLI 一次性上传到云存储 content/ui/。
// 保持相对路径与 dpr 变体（@2x/@3x/无后缀）不变——asset-path.ts 按设备 dpr 直取。
// 注意：暂存目录放在项目根（而不是 cloud/ 下），避免拖慢开发者工具打包/二维码生成。

const SRC_ROOT = path.join(__dirname, '../miniprogram/assets');
const STAGING_ROOT = path.join(__dirname, '../.cdn-staging/ui');
const ALLOWED_EXT = new Set(['.webp', '.aac']);

function walk(dir, base = '') {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, ent.name);
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walk(full, rel));
    } else if (ALLOWED_EXT.has(path.extname(ent.name).toLowerCase())) {
      out.push(rel);
    }
  }
  return out;
}

function main() {
  // 清空旧暂存（避免已删除的文件残留上传）
  fs.rmSync(STAGING_ROOT, { recursive: true, force: true });

  const files = walk(SRC_ROOT);
  let totalBytes = 0;
  for (const rel of files) {
    const src = path.join(SRC_ROOT, rel);
    const dest = path.join(STAGING_ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    totalBytes += fs.statSync(src).size;
  }

  console.log(`已暂存 ${files.length} 个文件，共 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`暂存目录: ${STAGING_ROOT}`);
  console.log('');
  console.log('接下来执行（首次使用先登录，会弹二维码）:');
  console.log('  npx @cloudbase/cli login');
  console.log(
    `  npx @cloudbase/cli storage upload ${STAGING_ROOT} content/ui -e cloud1-d9ghjbijh5aa24e10`,
  );
}

main();
