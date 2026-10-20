import { NOTICE_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

/** 通用通知弹窗：标题 + 可滚动正文，面板下方居中放确认按钮 */
Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    content: { type: String, value: '' },
  },

  data: {
    okBtn: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(NOTICE_ASSETS.okBtn).then((okBtn) => {
        this.setData({ okBtn });
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
