/** 页面跳转：失败时提示，避免静默无法进入 */

/** 连点锁：一次 navigateTo 后短暂忽略重复调用，防止同页堆叠（如连点两次进商店） */
let navigating = false;
const NAV_LOCK_MS = 600;

export function navigateTo(url: string) {
  if (navigating) return;
  navigating = true;
  setTimeout(() => {
    navigating = false;
  }, NAV_LOCK_MS);
  wx.navigateTo({
    url,
    fail: (err) => {
      console.error('[nav] navigateTo fail', url, err);
      wx.showToast({ title: '打不开这个页面', icon: 'none' });
    },
  });
}

export function navigateBack(fallbackUrl = '/pages/home/index') {
  wx.navigateBack({
    fail: () => {
      wx.reLaunch({ url: fallbackUrl });
    },
  });
}
