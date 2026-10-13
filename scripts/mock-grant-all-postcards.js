/** mock 验证 admin/grantAllPostcards（排除废卡）+ removeIncompleteCards（清除废卡） */
const path = require('path');
const fs = require('fs');
const Module = require('module');

const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../cloud/seed/trip-catalog.json'), 'utf8'),
);

const TARGET = 'o-PoB7YiapBTgn0ihmq_NCVvbzO4';
const dbData = {
  users: [{ _id: 'u1', openid: TARGET }],
  postcards: [
    ...seed.postcards.map((p, i) => ({ _id: `pc${i}`, id: p.id })),
    // 两张废卡混在主表里
    { _id: 'w1', id: 'pc_30' },
    { _id: 'w2', id: 'pc_163' },
  ],
  user_postcards: [
    // 预置一条已有图鉴，验证不会被覆盖
    { _id: 'up0', userId: TARGET, postcardId: seed.postcards[0].id, claimCount: 5 },
    // 预置一张废卡图鉴（别的用户的），验证会被清除
    { _id: 'upw', userId: 'someone-else', postcardId: 'pc_30', claimCount: 1 },
  ],
};

function matches(doc, cond) {
  return Object.entries(cond).every(([k, v]) => {
    if (v && typeof v === 'object' && Array.isArray(v.$in)) return v.$in.includes(doc[k]);
    return doc[k] === v;
  });
}

function makeQuery(col, cond) {
  return {
    where: (c) => makeQuery(col, c),
    limit: () => makeQuery(col, cond),
    get: async () => ({
      data: cond ? dbData[col].filter((d) => matches(d, cond)) : dbData[col],
    }),
    remove: async () => {
      const before = dbData[col].length;
      dbData[col] = dbData[col].filter((d) => !matches(d, cond));
      return { stats: { removed: before - dbData[col].length } };
    },
  };
}

function makeCollection(col) {
  return {
    where: (cond) => makeQuery(col, cond),
    limit: () => ({ get: async () => ({ data: dbData[col] }) }),
    add: async ({ data }) => {
      dbData[col].push({ _id: `new${dbData[col].length}`, ...data });
      return {};
    },
  };
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'wx-server-sdk') return request;
  return origResolve.call(this, request, ...args);
};
require.cache['wx-server-sdk'] = {
  id: 'wx-server-sdk',
  filename: 'wx-server-sdk',
  loaded: true,
  exports: {
    init: () => {},
    DYNAMIC_CURRENT_ENV: 'test',
    database: () => ({
      collection: makeCollection,
      command: { in: (arr) => ({ $in: arr }) },
    }),
    getWXContext: () => ({ OPENID: 'test-admin' }),
  },
};

const admin = require('../cloud/functions/admin/index.js');
const SECRET = 'lxxs-dev-admin-secret-change-me';

(async () => {
  let bad = 0;

  // 1. grantAllPostcards：废卡不应被录入
  const res = await admin.main({
    action: 'grantAllPostcards',
    payload: { openid: TARGET },
    adminSecret: SECRET,
  });
  console.log('grant 返回:', JSON.stringify(res));
  if (!res.ok) { console.error('grant 失败'); bad++; }
  const mine = dbData.user_postcards.filter((d) => d.userId === TARGET);
  if (mine.some((d) => d.postcardId === 'pc_30' || d.postcardId === 'pc_163')) {
    console.error('废卡被录入图鉴');
    bad++;
  }
  if (mine.length !== seed.postcards.length) {
    console.error(`图鉴数量不对: ${mine.length} / ${seed.postcards.length}`);
    bad++;
  }
  const kept = dbData.user_postcards.find((d) => d._id === 'up0');
  if (kept.claimCount !== 5) { console.error('已有图鉴被覆盖'); bad++; }

  // 2. removeIncompleteCards：主表 + 全用户图鉴的废卡都被删
  const res2 = await admin.main({ action: 'removeIncompleteCards', adminSecret: SECRET });
  console.log('remove 返回:', JSON.stringify(res2));
  if (!res2.ok) { console.error('remove 失败'); bad++; }
  if (dbData.postcards.some((d) => d.id === 'pc_30' || d.id === 'pc_163')) {
    console.error('主表废卡残留');
    bad++;
  }
  if (dbData.user_postcards.some((d) => d.postcardId === 'pc_30')) {
    console.error('图鉴废卡残留');
    bad++;
  }
  // 正常卡不受影响
  if (dbData.postcards.length !== seed.postcards.length) {
    console.error('误删正常主表卡');
    bad++;
  }
  if (!dbData.user_postcards.find((d) => d._id === 'up0')) {
    console.error('误删正常图鉴');
    bad++;
  }

  // 3. 幂等：再跑一遍 remove 应删 0 条
  const res3 = await admin.main({ action: 'removeIncompleteCards', adminSecret: SECRET });
  if (res3.data.postcardsRemoved !== 0 || res3.data.userPostcardsRemoved !== 0) {
    console.error('remove 幂等失败', JSON.stringify(res3.data));
    bad++;
  }

  console.log(bad === 0 ? '✓ mock 验证通过' : `✗ ${bad} 处问题`);
  process.exit(bad === 0 ? 0 : 1);
})();
