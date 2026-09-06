import {
  getAudioPrefs,
  setMusicEnabled,
  setSfxEnabled,
} from '../../services/audio-prefs';
import {
  getNotifyEnabled,
  requestNotifyAuth,
  setNotifyEnabled,
  syncNotifySubscribe,
  syncNotifyUnsubscribe,
} from '../../services/notify';
import { playTap } from '../../services/sound';
import { getUserId } from '../../store/user';
import GAME from '../../utils/constants';
import { SETTINGS_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
  },

  data: {
    musicEnabled: true,
    sfxEnabled: true,
    /** 通知开关：本地持久化 + 订阅消息授权（见 services/notify） */
    notifyEnabled: getNotifyEnabled(),
    userId: '',
    appVersion: GAME.APP_VERSION,
    assets: {
      panel: '',
      toggleOn: '',
      toggleOff: '',
      userIdBar: '',
      notifyOnSel: '',
      notifyOnUnsel: '',
      notifyOffSel: '',
      notifyOffUnsel: '',
    },
  },

  lifetimes: {
    attached() {
      resolveAssetMap(SETTINGS_ASSETS).then((assets) => {
        this.setData({ assets });
      });
      this.refreshPrefs();
    },
  },

  observers: {
    visible(v: boolean) {
      if (v) this.refreshPrefs();
    },
  },

  methods: {
    onStop() {},

    onClose() {
      this.triggerEvent('close');
    },

    refreshPrefs() {
      const prefs = getAudioPrefs();
      this.setData({
        musicEnabled: prefs.musicEnabled,
        sfxEnabled: prefs.sfxEnabled,
        userId: getUserId(),
      });
    },

    onToggleMusic() {
      playTap();
      const next = !this.data.musicEnabled;
      setMusicEnabled(next);
      this.setData({ musicEnabled: next });
    },

    onToggleSfx() {
      playTap();
      const next = !this.data.sfxEnabled;
      setSfxEnabled(next);
      this.setData({ sfxEnabled: next });
    },

    /** 开：先向微信请求订阅授权，允许后才打开并持久化；拒绝则保持关闭 */
    async onNotifyOn() {
      playTap();
      if (this.data.notifyEnabled) return;
      const granted = await requestNotifyAuth();
      if (!granted) return;
      setNotifyEnabled(true);
      this.setData({ notifyEnabled: true });
      syncNotifySubscribe();
    },

    /** 关：直接关闭并持久化，同步云端清除订阅 */
    onNotifyOff() {
      playTap();
      if (!this.data.notifyEnabled) return;
      setNotifyEnabled(false);
      this.setData({ notifyEnabled: false });
      syncNotifyUnsubscribe();
    },
  },
});
