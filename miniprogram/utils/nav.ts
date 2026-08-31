/** 页面跳转：失败时提示，避免静默无法进入 */
export function navigateTo(url: string) {
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
