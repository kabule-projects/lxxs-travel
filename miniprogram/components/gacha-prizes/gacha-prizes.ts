import type { GachaCatalogItem } from '../../services/gacha';
import { COMMON_ASSETS, GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    items: { type: Array, value: [] },
  },

  data: {
    panelBg: '',
    itemBg: '',
    iconClose: '',
    lockIcon: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(GACHA_ASSETS.catalogPanel).then((panelBg) => {
        this.setData({ panelBg });
      });
      /** 与结果弹窗共用物品格底图 */
      resolveAsset(GACHA_ASSETS.resultItemBg).then((itemBg) => {
        this.setData({ itemBg });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      resolveAsset(GACHA_ASSETS.prizeLocked).then((lockIcon) => {
        this.setData({ lockIcon });
      });
    },
  },

  methods: {
    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
  },
});
