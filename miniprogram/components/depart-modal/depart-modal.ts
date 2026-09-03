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
  },

  lifetimes: {
    attached() {
      resolveAsset(DEPART_ASSETS.panel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(DEPART_ASSETS.btnWait).then((btnWait) => {
        this.setData({ btnWait });
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
