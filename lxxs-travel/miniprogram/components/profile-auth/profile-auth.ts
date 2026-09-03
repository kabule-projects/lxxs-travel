import { PROFILE_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
  },

  data: {
    nickName: '',
    avatarUrl: '',
    submitting: false,
    panelBg: '',
    avatarPlaceholder: '',
    btnSubmit: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(PROFILE_ASSETS.panel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(PROFILE_ASSETS.avatarPlaceholder).then((avatarPlaceholder) => {
        this.setData({ avatarPlaceholder });
      });
      resolveAsset(PROFILE_ASSETS.btnSubmit).then((btnSubmit) => {
        this.setData({ btnSubmit });
      });
    },
  },

  methods: {
    onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
      const url = (e.detail as { avatarUrl?: string }).avatarUrl || '';
      if (url) this.setData({ avatarUrl: url });
    },

    onNicknameInput(e: WechatMiniprogram.Input) {
      this.setData({ nickName: (e.detail.value || '').trim() });
    },

    async onSubmit() {
      if (this.data.submitting) return;
      const nickName = (this.data.nickName || '').trim();
      if (!nickName) {
        wx.showToast({ title: '请填写昵称', icon: 'none' });
        return;
      }
      this.setData({ submitting: true });
      try {
        this.triggerEvent('submit', {
          nickName,
          avatarUrl: this.data.avatarUrl,
        });
      } finally {
        this.setData({ submitting: false });
      }
    },
  },
});
