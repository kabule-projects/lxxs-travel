import { COMMON_ASSETS, GACHA_ASSETS, SHOWCASE_ASSETS } from '../../utils/asset-path';
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
    itemBg: '',
    iconClose: '',
    btnConfirm: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(SHOWCASE_ASSETS.detailPanel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(SHOWCASE_ASSETS.detailItemBg).then((itemBg) => {
        this.setData({ itemBg });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      // 复用扭蛋结果弹窗的通用确认按钮贴图
      resolveAsset(GACHA_ASSETS.btnConfirm).then((btnConfirm) => {
        this.setData({ btnConfirm });
      });
    },
  },

  methods: {
    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },
  },
});
