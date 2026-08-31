const cloud = require('wx-server-sdk');
const { ok, fail } = require('../common/response');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { action } = event || {};
  switch (action) {
    case 'ping':
      return ok({ service: 'stubCheckin', stub: 'V2', ts: Date.now() });
    default:
      return fail('签到系统 V2', 'NOT_IMPLEMENTED');
  }
};
