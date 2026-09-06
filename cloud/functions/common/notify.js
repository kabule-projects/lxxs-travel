const cloud = require('wx-server-sdk');
const { getUserByOpenid } = require('./user');

function formatNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 小深旅行归来订阅通知：一次授权发一条，发送后消费掉 pending。
 * 任何异常都不外抛，绝不影响行程状态推进。
 */
async function sendTripReturnNotice(openid) {
  const db = cloud.database();
  try {
    const user = await getUserByOpenid(db, openid);
    if (!user || !user.notifyEnabled || !user.notifyPending) return false;
    if (!user.notifyTmplId) return false;

    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      template_id: user.notifyTmplId,
      page: 'pages/home/index',
      // data 字段名需与 mp 后台模板关键词一致，不一致时发送会报错，按实际模板调整
      data: {
        thing1: { value: '小深旅行回来啦' },
        time2: { value: formatNow() },
      },
    });

    await db.collection('users').doc(user._id).update({
      data: { notifyPending: false },
    });
    return true;
  } catch (e) {
    console.warn('sendTripReturnNotice fail', e);
    // 授权已消费或失效（如 43101 用户拒收），置 pending=false 避免每次都重试
    try {
      const user = await getUserByOpenid(db, openid);
      if (user) {
        await db.collection('users').doc(user._id).update({
          data: { notifyPending: false },
        });
      }
    } catch (e2) {
      /* ignore */
    }
    return false;
  }
}

module.exports = { sendTripReturnNotice };
