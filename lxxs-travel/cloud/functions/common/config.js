/** Admin / GM openid whitelist. Override via env ADMIN_OPENIDS / GM_OPENIDS (comma-separated). */

const DEFAULT_ADMIN_OPENIDS = [];
const DEFAULT_GM_OPENIDS = [];

function parseList(raw) {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getAdminOpenids() {
  return parseList(process.env.ADMIN_OPENIDS).length
    ? parseList(process.env.ADMIN_OPENIDS)
    : DEFAULT_ADMIN_OPENIDS;
}

function getGmOpenids() {
  const gm = parseList(process.env.GM_OPENIDS);
  const admin = getAdminOpenids();
  return gm.length ? gm : admin.length ? admin : DEFAULT_GM_OPENIDS;
}

function getAdminSecret() {
  return process.env.ADMIN_SECRET || 'lxxs-dev-admin-secret-change-me';
}

module.exports = { getAdminOpenids, getGmOpenids, getAdminSecret };
