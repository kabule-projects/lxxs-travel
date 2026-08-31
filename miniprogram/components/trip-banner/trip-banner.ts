import { TRIP_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    text: { type: String, value: '' },
  },

  data: {
    bannerBg: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(TRIP_ASSETS.banner).then((bannerBg) => {
        this.setData({ bannerBg });
      });
    },
  },
});
