// 部署步骤：
// 1. 在微信公众平台(mp.weixin.qq.com)「订阅通知」中创建一次性订阅消息模板
//    （如"旅行归来"：thing 类关键词 + time 类关键词），把模板 ID 填入 miniprogram/config/notify.ts
// 2. 微信开发者工具中右键本目录上传并部署 cloud/functions/notify
// 3. 若云开发控制台要求确认权限，允许 subscribeMessage.send（package.json 已声明）
const cloud = require('wx-server-sdk');
const { ok, fail } = require('./common/response');
const { getUserByOpenid } = require('./common/user');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return fail('未获取 openid', 'UNAUTHORIZED');

    const user = await getUserByOpenid(db, OPENID);
    if (!user) return fail('用户不存在', 'NOT_FOUND');

    switch (event?.action) {
      case 'subscribe':
        // 记录一次待消费授权：小深归来时发一条订阅消息
        await db.collection('users').doc(user._id).update({
          data: {
            notifyEnabled: true,
            notifyPending: true,
            notifyTmplId: event.tmplId || '',
            notifyUpdatedAt: db.serverDate(),
          },
        });
        return ok({ subscribed: true });
      case 'unsubscribe':
        await db.collection('users').doc(user._id).update({
          data: {
            notifyEnabled: false,
            notifyPending: false,
            notifyTmplId: '',
            notifyUpdatedAt: db.serverDate(),
          },
        });
        return ok({ subscribed: false });
      default:
        return fail('未知 action', 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'notify error', e.code || 'ERROR');
  }
};
