import { CLOUD_ENV_ID, isCloudConfigured } from './config/cloud';
import { ensureSession } from './services/auth';
import { initAudioPrefs } from './services/sound';
import { isSupportedOrDevtools } from './utils/device';

App({
  globalData: {
    supported: true,
    cloudReady: false,
  },

  async onLaunch() {
    initAudioPrefs();

    if (!isSupportedOrDevtools()) {
      this.globalData.supported = false;
      wx.reLaunch({ url: '/pages/tollgate/index' });
      return;
    }

    if (wx.cloud) {
      wx.cloud.init({
        env: isCloudConfigured() ? CLOUD_ENV_ID : undefined,
        traceUser: true,
      });
      this.globalData.cloudReady = isCloudConfigured();
    }

    if (this.globalData.cloudReady) {
      try {
        await ensureSession();
      } catch (e) {
        console.warn('[app] login skipped:', e);
      }
    }
  },
});
