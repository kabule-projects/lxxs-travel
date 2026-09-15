/** 页面跳转：失败时提示，避免静默无法进入 */

/** 全局跳转锁：一次跳转落地前忽略后续 navigateTo，防止连点/动画期间堆叠同一页面多次 */
let navigating = false;
/**  settle 缓冲：页面落地后再多挡一小段动画时间 */
const NAV_SETTLE_MS = 400;

export function navigateTo(url: string) {
  if (navigating) return;
  navigating = true;
  const release = () => {
    setTimeout(() => {
      navigating = false;
    }, NAV_SETTLE_MS);
  };
  // 硬超时自愈：转场动画期间发起的 navigateTo 可能无任何回调
  const hardReset = setTimeout(() => {
    navigating = false;
  }, 1500);
  const options = {
    url,
    success: () => {
      clearTimeout(hardReset);
      release();
    },
    fail: (err: unknown) => {
      clearTimeout(hardReset);
      navigating = false;
      console.error('[nav] navigateTo fail', url, err);
      wx.showToast({ title: '打不开这个页面', icon: 'none' });
    },
  };
  // 项目裁剪版 wx 类型只声明了 url/fail，实际基础库支持 success
  wx.navigateTo(options as unknown as Parameters<typeof wx.navigateTo>[0]);
}

/** 返回锁：防止返回键连点一次弹两层 / fail 兜底重复触发 */
let backing = false;

export function navigateBack(fallbackUrl = '/pages/home/index') {
  if (backing) return;
  backing = true;
  const release = () => {
    setTimeout(() => {
      backing = false;
    }, NAV_SETTLE_MS);
  };
  // 硬超时自愈：页面转场动画期间 navigateBack 可能无任何回调，锁会卡死导致"要点两次"
  const hardReset = setTimeout(() => {
    backing = false;
  }, 1500);
  const options = {
    fail: () => {
      wx.reLaunch({ url: fallbackUrl });
    },
    complete: () => {
      clearTimeout(hardReset);
      release();
    },
  };
  wx.navigateBack(options as unknown as Parameters<typeof wx.navigateBack>[0]);
}
