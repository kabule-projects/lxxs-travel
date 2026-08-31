import { COMMON_ASSETS, SHOWCASE_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    image: { type: String, value: '' },
    description: { type: String, value: '' },
  },

  data: {
    panelBg: '',
    iconClose: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(SHOWCASE_ASSETS.detailPanel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
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
