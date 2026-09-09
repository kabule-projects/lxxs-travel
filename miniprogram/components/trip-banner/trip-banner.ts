import { TRIP_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    /** depart = 出门提示图；return = 回家提示图（文案在图内） */
    mode: { type: String, value: 'depart' },
  },

  data: {
    departSrc: '',
    returnSrc: '',
  },

  lifetimes: {
    attached() {
      Promise.all([
        resolveAsset(TRIP_ASSETS.bannerDepart),
        resolveAsset(TRIP_ASSETS.bannerReturn),
      ]).then(([departSrc, returnSrc]) => {
        this.setData({ departSrc, returnSrc });
      });
    },
  },

  methods: {
    /** 点击横幅任意处立即关闭（5 秒自动消失由页面侧定时器兜底） */
    onTap() {
      this.triggerEvent('dismiss');
    },
  },
});
