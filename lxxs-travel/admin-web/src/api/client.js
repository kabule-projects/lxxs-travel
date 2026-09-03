const BASE = import.meta.env.VITE_ADMIN_API_URL || '';
const SECRET = import.meta.env.VITE_ADMIN_SECRET || 'lxxs-dev-admin-secret-change-me';

/**
 * 调用 admin 云函数（HTTP 触发或本地代理）
 * body: { action, payload }
 */
export async function adminCall(action, payload = {}) {
  if (!BASE) {
    throw new Error('未配置 VITE_ADMIN_API_URL（admin 云函数 HTTP 地址）');
  }
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload, adminSecret: SECRET }),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || '请求失败');
  }
  return json.data;
}

export function isApiConfigured() {
  return Boolean(BASE);
}
