const lastShown: Record<string, number> = {};

const DEFAULT_TITLE = '网络异常，请检查网络';

/**
 * 云端请求失败的统一用户提示（toast）。
 * 同一 key 在 throttleMs 内只弹一次，避免 onTick 周期同步失败时刷屏；
 * 点击类交互用默认 3s 节流，轮询类调用方传更大的 throttleMs。
 */
export function toastCloudError(
  key = 'default',
  title = DEFAULT_TITLE,
  throttleMs = 3_000,
): void {
  const now = Date.now();
  const last = lastShown[key] || 0;
  if (now - last < throttleMs) return;
  lastShown[key] = now;
  wx.showToast({ title, icon: 'none' });
}
