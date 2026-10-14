import { WARDROBE_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea } from '../../utils/device';
import { getFit } from '../../utils/fit';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { listWardrobe } from '../../services/wardrobe';

type PageAssets = Record<keyof typeof WARDROBE_ASSETS, string>;

Page({
  data: {
    /** 设计舞台内联样式（短宽屏缩放；见 utils/fit.ts） */
    stageStyle: '',
    /** 顶栏 padding-top：安全区上沿（舞台坐标 px） */
    safeTop: 0,
    assets: {} as PageAssets,
    empty: true,
    message: '',
    showSettings: false,
  },

  onLoad() {
    const { top } = readSafeArea();
    const fit = getFit();
    this.setData({ safeTop: fit.toStageY(top), stageStyle: fit.stageStyle });
    resolveAssetMap(WARDROBE_ASSETS).then((assets) => {
      this.setData({ assets });
    });
  },

  onShow() {
    this.reload();
  },

  async reload() {
    try {
      const res = await listWardrobe();
      this.setData({
        empty: res.empty,
        message: res.message || '衣柜还是空的',
      });
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '衣柜加载失败',
        icon: 'none',
      });
    }
  },

  onTapBack() {
    navigateBack('/pages/home/index');
  },

  onTapSettings() {
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },
});
