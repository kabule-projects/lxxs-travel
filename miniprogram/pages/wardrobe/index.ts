import { WARDROBE_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { listWardrobe } from '../../services/wardrobe';

type PageAssets = Record<keyof typeof WARDROBE_ASSETS, string>;

Page({
  data: {
    safeTop: 0,
    assets: {} as PageAssets,
    empty: true,
    message: '',
    showSettings: false,
  },

  onLoad() {
    const { top } = readSafeArea();
    this.setData({ safeTop: top });
    resolveAssetMap(WARDROBE_ASSETS).then((assets) => {
      this.setData({ assets });
    });
  },

  onShow() {
    this.reload();
  },

  async reload() {
    const res = await listWardrobe();
    this.setData({
      empty: res.empty,
      message: res.message || '衣柜还是空的',
    });
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
