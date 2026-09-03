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
    iconClose: '',
    lockIcon: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(GACHA_ASSETS.catalogPanel).then((panelBg) => {
        this.setData({ panelBg });
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
