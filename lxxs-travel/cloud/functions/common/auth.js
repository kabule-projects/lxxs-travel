const { getAdminOpenids, getGmOpenids, getAdminSecret } = require('./config');

function assertAdmin(context, adminSecret) {
  const { OPENID } = context;
  const openids = getAdminOpenids();
  if (adminSecret && adminSecret === getAdminSecret()) {
    return OPENID || 'admin-secret';
  }
  if (!OPENID) {
    const err = new Error('未登录');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (openids.length && !openids.includes(OPENID)) {
    const err = new Error('非管理员');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return OPENID;
}

function assertGm(context) {
  const { OPENID } = context;
  const openids = getGmOpenids();
  if (!OPENID) {
    const err = new Error('未登录');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (openids.length && !openids.includes(OPENID)) {
    const err = new Error('非 GM');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return OPENID;
}

module.exports = { assertAdmin, assertGm };
