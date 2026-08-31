import { DEPART_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    farewell: { type: String, value: '' },
  },

  data: {
    panelBg: '',
    btnWait: '',
    btnConfirm: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(DEPART_ASSETS.panel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(DEPART_ASSETS.btnWait).then((btnWait) => {
        this.setData({ btnWait });
      });
      resolveAsset(DEPART_ASSETS.btnConfirm).then((btnConfirm) => {
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
