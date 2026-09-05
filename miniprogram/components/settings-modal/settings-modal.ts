import {
  getAudioPrefs,
  setMusicEnabled,
  setSfxEnabled,
} from '../../services/audio-prefs';
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
    /** 通知开关：真实逻辑未接（订阅消息 API），暂仅视觉状态 */
    notifyEnabled: false,
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

    /** TODO: 接订阅消息（wx.requestSubscribeMessage）；当前仅切换视觉状态，不持久化 */
    onNotifyOn() {
      playTap();
      if (!this.data.notifyEnabled) this.setData({ notifyEnabled: true });
    },

    onNotifyOff() {
      playTap();
      if (this.data.notifyEnabled) this.setData({ notifyEnabled: false });
    },
  },
});
