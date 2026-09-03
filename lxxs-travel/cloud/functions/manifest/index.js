const cloud = require('wx-server-sdk');
const { ok, fail } = require('../common/response');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/** 公开只读：资源 manifest + 签名 URL（需 fileID） */
exports.main = async (event) => {
  try {
    const { action, payload = {} } = event || {};

    switch (action) {
      case 'list': {
        const res = await db.collection('asset_manifest').get();
        return ok(res.data);
      }
      case 'getSignedUrl': {
        const { fileID } = payload;
        if (!fileID) return fail('缺少 fileID', 'VALIDATION');
        const res = await cloud.getTempFileURL({
          fileList: [{ fileID, maxAge: 900 }],
        });
        const item = res.fileList[0];
        if (item.status !== 0) return fail(item.errMsg || '签名失败', 'STORAGE');
        return ok({ url: item.tempFileURL, expiresIn: 900 });
      }
      case 'ping':
        return ok({ service: 'manifest', ts: Date.now() });
      default:
        return fail(`未知 action: ${action}`, 'BAD_ACTION');
    }
  } catch (e) {
    return fail(e.message || 'manifest error', e.code || 'ERROR');
  }
};
