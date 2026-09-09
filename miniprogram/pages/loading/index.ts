import { isSupportedOrDevtools, readSafeArea } from '../../utils/device';
import { assetWebp, LOADING_ASSETS, ROOF_SCENE_ASSETS, ROOF_ASSETS } from '../../utils/asset-path';
import { preloadImages } from '../../utils/preload';

import { ensureSession } from '../../services/auth';
import { playTap } from '../../services/sound';

Page({
  data: {
    progress: 0,
    tip: '正在加载…',
    canEnter: false,
    layersReady: false,
    /** 点按钮后预载屋顶资产中，防止重复点击 */
    entering: false,
    bgSrc: '',
    btnEnterSrc: '',
    btnEnterDisabledSrc: '',
    safeTop: 0,
    safeBottom: 0,
    sessionReady: false,
  },

  _bootDone: false,
  _layerCount: 0,
  _targetLayerCount: 1,
  _navigated: false,
  _entering: false,

  onLoad() {
    if (!isSupportedOrDevtools()) {
      wx.reLaunch({ url: '/pages/tollgate/index' });
      return;
    }

    const safe = readSafeArea();
    this.setData({
      safeTop: safe.top,
      safeBottom: Math.max(safe.bottom, 0),
    });

    this.resolveAssets().then(() => this.bootstrap());
  },

  async resolveAssets() {
    this.setData({
      bgSrc: assetWebp(LOADING_ASSETS.bg),
      btnEnterSrc: assetWebp(LOADING_ASSETS.btnEnter),
      btnEnterDisabledSrc: assetWebp(LOADING_ASSETS.btnEnterDisabled),
    });
  },

  onLayerLoaded() {
    this._layerCount += 1;
    if (this._layerCount >= this._targetLayerCount) {
      this.setData({ layersReady: true });
      this.tryFinishBoot();
    }
  },

  onLayerError() {
    this._layerCount += 1;
    if (this._layerCount >= this._targetLayerCount) {
      this.setData({ layersReady: true });
      this.tryFinishBoot();
    }
  },

  tickProgress(target: number, tip?: string) {
    return new Promise<void>((resolve) => {
      const step = () => {
        const cur = this.data.progress;
        if (cur >= target) {
          if (tip !== undefined) this.setData({ tip });
          resolve();
          return;
        }
        const next = Math.min(target, cur + 2);
        const patch: Record<string, unknown> = { progress: next };
        if (tip !== undefined && next >= target) patch.tip = tip;
        this.setData(patch);
        setTimeout(step, 30);
      };
      step();
    });
  },

  async bootstrap() {
    const app = getApp<IAppOption>();
    await this.tickProgress(15, '加载资源…');
    await this.tickProgress(45, '准备场景…');

    try {
      await this.tickProgress(60, app.globalData.cloudReady ? '连接云端…' : '初始化…');
      await ensureSession();
      await this.tickProgress(85, '同步数据…');
      this.setData({ sessionReady: true });
    } catch (e) {
      console.warn('[loading] session fallback', e);
      await ensureSession();
      this.setData({ sessionReady: true });
      await this.tickProgress(85, '同步数据…');
    }

    this._bootDone = true;
    if (!this.data.layersReady) {
      this.setData({ layersReady: true });
    }
    await this.tryFinishBoot();
  },

  async tryFinishBoot() {
    if (!this._bootDone || !this.data.layersReady || !this.data.sessionReady) return;
    await this.tickProgress(100, '');
    this.setData({ canEnter: true, tip: '' });
    // this.enterGame(); // TODO: UI 调试完后恢复自动跳转
  },

  /** 预载屋顶页全部图片，全部下载完成（或超时兜底）后再跳转，避免落地后逐张闪现 */
  preloadRoofAssets(): Promise<void> {
    const urls = [
      assetWebp(ROOF_SCENE_ASSETS.bg),
      ...Object.values(ROOF_ASSETS).map((k) => assetWebp(k)),
    ];
    return preloadImages(urls, 5000);
  },

  enterGame() {
    if (this._navigated || this._entering) return;
    if (!this.data.sessionReady) {
      wx.showToast({ title: '还在加载中', icon: 'none' });
      return;
    }
    this._entering = true;
    this.setData({ entering: true });
    playTap();
    this.preloadRoofAssets().then(() => {
      this._navigated = true;
      wx.reLaunch({ url: '/pages/roof/index' });
    });
  },

  onEnterGame() {
    if (!this.data.canEnter) {
      wx.showToast({ title: '还在加载中', icon: 'none' });
      return;
    }
    this.enterGame();
  },
});

interface IAppOption {
  globalData: { supported: boolean; cloudReady: boolean };
}
