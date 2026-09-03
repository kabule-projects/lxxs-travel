const fs = require('fs');
const path = require('path');

// 源文件夹根目录（请根据实际路径调整）
const SRC_ROOT =
  'E:/界面预览和切图（程序媛特供版）(2)/界面预览和切图（程序媛特供版）/切图';
const DEST_ROOT = path.join(__dirname, '../miniprogram/assets');
const REPORT_PATH = path.join(__dirname, '../miniprogram/assets/ASSET-MAPPING.md');

// 源文件相对路径 -> 目标相对路径（不含扩展名）
const MAPPING = {
  // ================= loading =================
  'loading页/背景-有星图.webp': 'loading/bg',
  'loading页/进入游戏按钮@72x-8.webp': 'loading/btn-enter',
  'loading页/进度栏@72x-8.webp': 'loading/bar-track',
  'loading页/进度条@72x-8.webp': 'loading/bar-fill',
  'loading页/进度图标@72x-8.webp': 'loading/bar-thumb',

  // ================= roof scene (shared with loading) =================
  'loading页/背景-有星图.webp': 'shared/roof/bg',

  // ================= roof =================
  '屋顶/星星.webp': 'roof/star',
  'loading页/星星.webp': 'icons/home/star',
  '屋顶/米-顶层.webp': 'roof/star-rice',
  '屋顶/星星光环.webp': 'roof/star-glow',
  '屋顶/星星掉落剩余时间@72x-8.webp': 'roof/star-timer',
  '屋顶/准备按钮@72x-8.webp': 'home/btn-prepare',
  '屋顶/商店按钮@72x-8.webp': 'icons/home/shop',
  '屋顶/小屋按钮@72x-8.webp': 'icons/roof/home',
  '屋顶/物品按钮@72x-8.webp': 'icons/roof/items',
  '屋顶/普通星星数值栏@72x-8.webp': 'common/star-value-bar',
  '屋顶/米字星数值栏@72x-8.webp': 'common/rice-star-value-bar',
  '屋顶/设置按钮@72x-8.webp': 'icons/common/settings-grid',

  // ================= home =================
  '小屋/背景.webp': 'home/room',
  '小屋/窗户.webp': 'home/window',
  '小屋/准备按钮@72x-8.webp': 'home/btn-prepare',
  '小屋/商店按钮@72x-8.webp': 'icons/home/shop',
  '小屋/小屋按钮@72x-8.webp': 'icons/roof/home',
  '小屋/物品按钮@72x-8.webp': 'icons/home/bag',
  '小屋/普通星星数值栏@72x-8.webp': 'common/star-value-bar-home',
  '小屋/米字星数值栏@72x-8.webp': 'common/rice-star-value-bar-home',
  '小屋/设置按钮@72x-8.webp': 'icons/common/settings-grid',
  '小屋/左柜子.webp': 'showcase/cabinet',
  '小屋/日记本.webp': 'diary/notebook',

  // ================= shop =================
  '商店/背景_4@72x-8.webp': 'shop/page-bg',
  '商店/底下木板.webp': 'shop/wood-board',
  '商店/价签标.webp': 'shop/price-tag',
  '商店/购买按钮@72x-8.webp': 'shop/btn-buy',
  '商店/扭蛋按钮@72x-8.webp': 'icons/shop/utility-gacha',
  '商店/返回键@72x-8.webp': 'icons/shop/back',
  '商店/小屋按钮@72x-8.webp': 'icons/roof/home',
  '商店/普通星星数值栏@72x-8.webp': 'common/star-value-bar-shop',
  '商店/米字星数值栏@72x-8.webp': 'common/rice-star-value-bar-shop',
  '商店/设置按钮@72x-8.webp': 'icons/common/settings-grid',
  '商店/物品按钮@72x-8.webp': 'icons/roof/items',

  // ================= gacha =================
  '扭蛋/扭蛋机.webp': 'gacha/machine',
  '扭蛋/背景_2@72x-8.webp': 'gacha/page-bg',
  '扭蛋/兑换列表按钮@72x-8.webp': 'gacha/btn-prizes',
  '扭蛋/兑换提示@72x-8.webp': 'gacha/exchange-banner',
  '扭蛋/返回键@72x-8.webp': 'icons/shop/back',
  '扭蛋/设置按钮@72x-8.webp': 'icons/common/settings-grid',
  '扭蛋/普通星星数值栏@72x-8.webp': 'common/star-value-bar-gacha',
  '扭蛋/米字星数值栏@72x-8.webp': 'common/rice-star-value-bar-gacha',

  // ================= gacha popup =================
  '扭蛋弹窗/弹窗背景.webp': 'gacha/result-panel',
  '扭蛋弹窗/物品背景.webp': 'gacha/result-item-bg',
  '扭蛋弹窗/确定按钮.webp': 'gacha/btn-confirm',
  '扭蛋弹窗/关闭.webp': 'icons/common/close',
  '扭蛋弹窗/恭喜获得@72x-8.webp': 'gacha/result-title',

  // ================= prize popup =================
  '奖品弹窗/关闭.webp': 'icons/common/close-2',
  '奖品弹窗/已收集.webp': 'icons/gacha/prize-locked',
  '奖品弹窗/未收集.webp': 'icons/gacha/prize-unlocked',
  '奖品弹窗/纸.webp': 'diary/letter-paper',
  '奖品弹窗/矩形 3.webp': 'gacha/result-deco',
  '奖品弹窗/矩形 4.webp': 'gacha/catalog-deco',

  // ================= diary =================
  '日记/背景.webp': 'diary/frame',
  '日记/内页.webp': 'diary/notebook',
  '日记/选中.webp': 'diary/tab-active',
  '日记/未选中.webp': 'diary/tab',
  '日记/格子.webp': 'diary/grid-cell',

  // ================= postcard popup =================
  '明信片弹窗/信封按钮@72x-8.webp': 'icons/diary/envelope',
  '明信片弹窗/提示@72x-8.webp': 'mailbox/deco',

  // ================= unread mail =================
  '未读信件/关闭.webp': 'mailbox/icon-close',
  '未读信件/形状 5.webp': 'mailbox/panel',
  '未读信件/矩形 5.webp': 'mailbox/title',
  '未读信件/组 4.webp': 'mailbox/deco-2',

  // ================= inventory popup =================
  '物品列表/面板.webp': 'inventory/panel',
  '物品列表/美食未选中.webp': 'inventory/tab-food',
  '物品列表/美食选中.webp': 'inventory/tab-food-on',
  '物品列表/道具未选中.webp': 'inventory/tab-prop',
  '物品列表/道具选中.webp': 'inventory/tab-prop-on',
  '物品列表/行背景.webp': 'inventory/item-row',

  // ================= bag =================
  '背包/背包弹窗.webp': 'bag/panel',
  '背包/出发.webp': 'bag/btn-depart',
  '背包/关闭.webp': 'icons/common/close',
  '背包/关闭-1.webp': 'icons/common/close-1',

  // ================= showcase =================
  '纪念品柜/物品柜@72x-8.webp': 'showcase/cabinet',
  '纪念品柜/背景_3@72x-8.webp': 'showcase/shelf-board',
  '纪念品柜/返回键@72x-8.webp': 'icons/shop/back',
  '纪念品弹窗/弹窗背景.webp': 'showcase/detail-panel',
  '纪念品弹窗/关闭.webp': 'icons/common/close-2',
  '纪念品弹窗/物品背景.webp': 'showcase/detail-item-bg',
  '纪念品弹窗/物品名称.webp': 'showcase/detail-name',
  '纪念品弹窗/物品简介.webp': 'showcase/detail-desc',
  '纪念品弹窗/确定按钮.webp': 'common/btn-confirm',

  // ================= hints =================
  '通用提示/出门提示.webp': 'shared/trip-banner',
  '通用提示/回家提示.webp': 'shared/trip-banner-return',

  // ================= food items =================
  '美食/土笋冻.webp': 'items/food/tusundong',
  '美食/土豆.webp': 'items/food/tudou',
  '美食/巧克力.webp': 'items/food/qiaokeli',
  '美食/米饭.webp': 'items/food/mifan',
  '美食/粥.webp': 'items/food/zhou',
  '美食/蛋糕.webp': 'items/food/dangao',
  '商店/土笋冻.webp': 'items/food/tusundong',
  '商店/土豆.webp': 'items/food/tudou',
  '商店/巧克力.webp': 'items/food/qiaokeli',
  '商店/米饭.webp': 'items/food/mifan',
  '商店/粥.webp': 'items/food/zhou',
  '商店/蛋糕.webp': 'items/food/dangao',

  // ================= props / accessories / equipment =================
  '道具/帽子.webp': 'items/accessory/hat',
  '道具/熊.webp': 'items/accessory/bear',
  '道具/老嫑.webp': 'items/equipment/laobiao',
  '道具/话筒.webp': 'items/equipment/mic',

  // ================= souvenirs =================
  '纪念品/一专.webp': 'items/souvenir/yizhuan',
  '纪念品/二专.webp': 'items/souvenir/erzhuan',
  '纪念品/嫑.webp': 'items/souvenir/biao',
  '纪念品/油条.webp': 'items/souvenir/youtiao',
  '纪念品/画框1.webp': 'items/souvenir/frame-1',
  '纪念品/画框2.webp': 'items/souvenir/frame-2',
  '纪念品/画框3.webp': 'items/souvenir/frame-3',
  '纪念品/眼镜.webp': 'items/souvenir/glasses',
  '纪念品/红玫瑰.webp': 'items/souvenir/red-rose',
  '纪念品/蓝玫瑰.webp': 'items/souvenir/blue-rose',

  // ================= letters / postcards =================
  // 主图 imageFull（点开放大）
  '手写信/信件-1.webp': 'postcards/letter-1',
  '手写信/信件-2.webp': 'postcards/letter-2',
  '手写信/信件-3.webp': 'postcards/letter-3',
  '手写信/信件-4.webp': 'postcards/letter-4',
  '手写信/信件-5.webp': 'postcards/letter-5',
  '手写信/信件-6.webp': 'postcards/letter-6',
  '手写信/信件-7.webp': 'postcards/letter-7',
  '手写信/信件-8.webp': 'postcards/letter-8',
  '手写信/信件-9.webp': 'postcards/letter-9',
  // 缩略图 imageThumb（日记格子）— 待美术提供切图后取消注释并改源路径
  // '日记/明信片缩略-1.webp': 'postcards/letter-1-thumb',
  '手写信/信件-10.webp': 'postcards/letter-10',
  '手写信/信件-11.webp': 'postcards/letter-11',
  '手写信/信件-12.webp': 'postcards/letter-12',

  // ================= tutorials =================
  '教程/教程1.webp': 'tutorial/tutorial-1',
  '教程/教程2.webp': 'tutorial/tutorial-2',
  '教程/教程3.webp': 'tutorial/tutorial-3',
  '教程/教程4.webp': 'tutorial/tutorial-4',
  '教程/教程5.webp': 'tutorial/tutorial-5',
  '教程/教程6.webp': 'tutorial/tutorial-6',
  '教程/教程7.webp': 'tutorial/tutorial-7',
  '教程/教程8.webp': 'tutorial/tutorial-8',
  '教程/教程9.webp': 'tutorial/tutorial-9',
  '教程/教程10.webp': 'tutorial/tutorial-10',
  '教程/教程11.webp': 'tutorial/tutorial-11',
  '教程/教程12.webp': 'tutorial/tutorial-12',
  '教程/教程13.webp': 'tutorial/tutorial-13',
  '教程/教程14.webp': 'tutorial/tutorial-14',

  // ================= loading title layers =================
  'loading页/嫑-第三层.webp': 'loading/title-biao',
  'loading页/深-第二层.webp': 'loading/title-shen',
  'loading页/米-顶层.webp': 'loading/title-mi',
  '屋顶/深-第二层.webp': 'roof/char-shen',
  '屋顶/嫑-第三层.webp': 'roof/char-biao',
  '屋顶/米-顶层.webp': 'roof/char-mi',
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyWithDpr(src, destBase) {
  ensureDir(path.dirname(destBase));
  fs.copyFileSync(src, `${destBase}.webp`);
  fs.copyFileSync(src, `${destBase}@2x.webp`);
  fs.copyFileSync(src, `${destBase}@3x.webp`);
}

function main() {
  const report = [];
  report.push('# 资源映射报告\n');
  report.push(`生成时间：${new Date().toISOString()}\n`);
  report.push(`源目录：\`${SRC_ROOT}\`\n`);
  report.push(`目标目录：\`miniprogram/assets\`\n\n`);
  report.push('## 已映射资源\n\n');
  report.push('| 源文件 | 目标路径 | 状态 |\n');
  report.push('|--------|----------|------|\n');

  let ok = 0;
  let fail = 0;

  for (const [srcRel, destRel] of Object.entries(MAPPING)) {
    const src = path.join(SRC_ROOT, srcRel);
    const destBase = path.join(DEST_ROOT, destRel);
    if (fs.existsSync(src)) {
      try {
        copyWithDpr(src, destBase);
        report.push(`| \`${srcRel}\` | \`${destRel}\` | ✅ 已复制 |\n`);
        ok++;
      } catch (e) {
        report.push(`| \`${srcRel}\` | \`${destRel}\` | ❌ 复制失败：${e.message} |\n`);
        fail++;
      }
    } else {
      report.push(`| \`${srcRel}\` | \`${destRel}\` | ⚠️ 源文件不存在 |\n`);
      fail++;
    }
  }

  report.push(`\n**统计**：成功 ${ok} 个，失败/缺失 ${fail} 个。\n\n`);

  // 列出源目录中未被映射的文件
  report.push('## 未映射的源文件（需手动确认用途）\n\n');
  function walk(dir, base = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const rel = path.posix.join(base, ent.name);
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, rel);
      } else if (ent.name.endsWith('.webp') && !Object.keys(MAPPING).includes(rel)) {
        report.push(`- \`${rel}\`\n`);
      }
    }
  }
  walk(SRC_ROOT);

  // 列出代码引用但 assets 缺失的资源
  report.push('\n## 代码中引用但 assets 缺失的资源（需补充设计稿）\n\n');
  const assetPathContent = fs.readFileSync(
    path.join(__dirname, '../miniprogram/utils/asset-path.ts'),
    'utf8',
  );
  const codeMatches = assetPathContent.matchAll(/['\"]([a-z0-9_\-/]+)['\"]/g);
  const codePaths = new Set();
  for (const m of codeMatches) {
    const p = m[1];
    if (p.includes('/') && /^[a-z0-9\-//]+$/.test(p) && p.length > 3) {
      codePaths.add(p);
    }
  }
  const missing = [];
  for (const p of codePaths) {
    const base = path.join(DEST_ROOT, p);
    if (!fs.existsSync(`${base}.webp`) && !fs.existsSync(`${base}@2x.webp`)) {
      missing.push(p);
    }
  }
  missing.sort().forEach((p) => report.push(`- \`${p}\`\n`));
  report.push(`\n**共 ${missing.length} 个**。\n`);

  ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, report.join(''), 'utf8');

  console.log(`Done. copied ${ok}, failed/missing ${fail}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main();
