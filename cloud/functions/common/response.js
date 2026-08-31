/** @typedef {{ ok: true, data: unknown }} OkResult */
/** @typedef {{ ok: false, error: string, code?: string }} FailResult */

function ok(data) {
  return { ok: true, data };
}

function fail(error, code) {
  return { ok: false, error, code: code || 'ERROR' };
}

module.exports = { ok, fail };
