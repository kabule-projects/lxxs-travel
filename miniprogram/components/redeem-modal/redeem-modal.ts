import { redeemCode, describeRedeem } from '../../services/redeem';
import { playTap } from '../../services/sound';
import { REDEEM_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
  },

  data: {
    code: '',
    errorMsg: '',
    placeholder: '请输入兑换码',
    submitting: false,
    assets: {
      panel: '',
      input: '',
      confirm: '',
      close: '',
    },
  },

  lifetimes: {
    attached() {
      resolveAssetMap(REDEEM_ASSETS).then((assets) => {
        this.setData({ assets });
      });
    },
  },

  observers: {
    visible(v: boolean) {
      if (v) this.setData({ code: '', errorMsg: '', placeholder: '请输入兑换码', submitting: false });
    },
  },

  methods: {
    onStop() {},

    onClose() {
      if (this.data.submitting) return;
      this.triggerEvent('close');
    },

    onInput(e: { detail: { value: string } }) {
      this.setData({ code: e.detail.value, errorMsg: '', placeholder: '请输入兑换码' });
    },

    async onSubmit() {
      if (this.data.submitting) return;
      const code = this.data.code.trim();
      if (!code) return;
      playTap();
      this.setData({ submitting: true, errorMsg: '' });
      try {
        const res = await redeemCode(code);
        // 成功：系统弹窗提示，关闭兑换弹窗
        wx.showModal({
          title: '已兑换成功',
          content: describeRedeem(res),
          showCancel: false,
          confirmText: '收下',
        });
        this.triggerEvent('close');
      } catch (e) {
        const codeErr = (e as Error & { code?: string }).code;
        const msg = (e as Error).message || '兑换失败，请稍后再试';
        if (codeErr === 'NOT_FOUND_CODE') {
          this.setData({ code: '', errorMsg: '', placeholder: '兑换码不存在，请重新输入' });
        } else if (codeErr === 'ALREADY_USED') {
          this.setData({ errorMsg: '该兑换码已兑换' });
        } else {
          this.setData({ errorMsg: msg });
        }
      } finally {
        this.setData({ submitting: false });
      }
    },
  },
});
