/** mock 验证 admin/migratePostcardNames：拦截 db 调用，对内存数据跑迁移 */
const path = require('path');
const fs = require('fs');
const Module = require('module');

const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../cloud/seed/trip-catalog.json'), 'utf8'),
);

// 内存数据：postcards 主表（用 seed 前 3 条）+ trips 快照（模拟一封含周深落款）
const dbData = {
  postcards: seed.postcards.slice(0, 9).map((p, i) => ({ _id: `pc${i}`, ...p })),
  trips: [
    {
      _id: 'trip1',
      postcards: [
        { instanceId: 'a', title: '卡布叻周深携小熊', story: '看我的旅途新伙伴！——卡布叻周深携小熊', status: 'delivered' },
        { instanceId: 'b', title: '某标题', story: '无关内容', status: 'pending' },
      ],
    },
    { _id: 'trip2', postcards: [] },
  ],
};

const updates = [];
function makeCollection(name) {
  return {
    limit: () => makeCollection(name),
    skip: () => makeCollection(name),
    get: async () => ({ data: dbData[name] }),
    doc: (id) => ({
      update: async ({ data }) => {
        updates.push({ col: name, id, data });
        const doc = dbData[name].find((d) => d._id === id);
        Object.assign(doc, data);
      },
    }),
  };
}

// 拦截 require('wx-server-sdk')
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
    database: () => ({ collection: makeCollection, command: {} }),
    getWXContext: () => ({ OPENID: 'test-admin' }),
  },
};

const admin = require('../cloud/functions/admin/index.js');

(async () => {
  const res = await admin.main({ action: 'migratePostcardNames', adminSecret: 'lxxs-dev-admin-secret-change-me' });
  console.log('返回:', JSON.stringify(res));

  // 校验
  let bad = 0;
  for (const p of dbData.postcards) {
    if (typeof p.story === 'string' && p.story.includes('周深')) {
      console.error('主表残留:', p.id, p.story);
      bad++;
    }
  }
  const trip1 = dbData.trips[0];
  if (trip1.postcards[0].story.includes('周深')) { console.error('trips 快照 story 残留:', trip1.postcards[0].story); bad++; }
  if (trip1.postcards[0].title.includes('周深')) { console.error('trips 快照 title 残留:', trip1.postcards[0].title); bad++; }
  if (trip1.postcards[1].story !== '无关内容' || trip1.postcards[1].title !== '某标题') { console.error('误改了不含周深的快照'); bad++; }
  if (!trip1.postcards[0].story.includes('小深')) { console.error('快照 story 未写入小深:', trip1.postcards[0].story); bad++; }
  if (trip1.postcards[0].title !== '小深携小熊') { console.error('快照 title 替换不对:', trip1.postcards[0].title); bad++; }
  // 主表 title 校验
  for (const p of dbData.postcards) {
    if (typeof p.title === 'string' && p.title.includes('周深')) {
      console.error('主表 title 残留:', p.id, p.title);
      bad++;
    }
  }
  console.log('更新调用次数:', updates.length);
  console.log(bad === 0 ? '✓ mock 验证通过' : `✗ ${bad} 处问题`);
  process.exit(bad === 0 ? 0 : 1);
})();
