import { isSupportedOrDevtools, readSafeArea } from '../../utils/device';
import {
  assetWebp,
  assetWebpCandidates,
  LOADING_ASSETS,
  ROOF_ASSETS,
  ROOF_SCENE_ASSETS,
  preloadFirstAvailable,
} from '../../utils/asset-path';

import { ensureSession } from '../../services/auth';
import { playTap } from '../../services/sound';

Page({
  data: {
    progress: 0,
    tip: '正在加载…',
    canEnter: false,
    layersReady: false,
    bgSrc: '',
    btnEnterSrc: '',
    btnEnterDisabledSrc: '',
    // 角色/鸽子/帽子/logo 等装饰贴图（同步拼路径）
    charShenSrc: '',
    charBiaoSrc: '',
    charMiSrc: '',
    pigeonSrc: '',
    magicHatSrc: '',
    starSrc: '',
    starGlowSrc: '',
    logoSrc: '',
    // 静态 dropped 星星
    droppedStars: [
      { id: 's1', left: 22, top: 74, rotate: -15, zIndex: 6 },
      { id: 's2', left: 76, top: 73, rotate: 20, zIndex: 6 },
      { id: 's3', left: 69, top: 72.5, rotate: 5, zIndex: 6 },
      { id: 's4', left: 30, top: 75, rotate: -30, zIndex: 6 },
    ],
    safeTop: 0,
    safeBottom: 0,
    sessionReady: false,
  },

  _bootDone: false,
  _layerCount: 0,
  _targetLayerCount: 1,
  _navigated: false,

  onLoad() {
    if (!isSupportedOrDevtools()) {
      wx.reLaunch({ url: '/pages/tollgate/index' });
      return;
    }

    const safe = readSafeArea();
    this.setData({
      safeTop: safe.top,
      safeBottom: Math.max(safe.bottom, 0),
      // 装饰贴图直接同步拼路径，不走异步 preload
      charShenSrc: assetWebp(ROOF_ASSETS.charShen),
      charBiaoSrc: assetWebp(ROOF_ASSETS.charBiao),
      charMiSrc: assetWebp(ROOF_ASSETS.charMi),
      pigeonSrc: assetWebp(ROOF_ASSETS.pigeon),
      magicHatSrc: assetWebp(ROOF_ASSETS.magicHat),
      starSrc: assetWebp(ROOF_ASSETS.star),
      starGlowSrc: assetWebp(ROOF_ASSETS.starGlow),
      logoSrc: assetWebp(LOADING_ASSETS.logo),
    });

    this.resolveAssets().then(() => this.bootstrap());
  },

  async resolveAssets() {
    try {
      const [bgSrc, btnEnterSrc, btnEnterDisabledSrc] = await Promise.all([
        preloadFirstAvailable(assetWebpCandidates(ROOF_SCENE_ASSETS.bg)),
        preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.btnEnter)),
        preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.btnEnterDisabled)).catch(
          () => preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.btnEnter)),
        ),
      ]);
      this.setData({ bgSrc, btnEnterSrc, btnEnterDisabledSrc });
    } catch (e) {
      console.warn('[loading] asset resolve fallback', e);
      this.setData({
        bgSrc: assetWebp(ROOF_SCENE_ASSETS.bg),
        btnEnterSrc: assetWebp(LOADING_ASSETS.btnEnter),
        btnEnterDisabledSrc: assetWebp(LOADING_ASSETS.btnEnterDisabled),
      });
    }
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

  enterGame() {
    if (this._navigated) return;
    if (!this.data.sessionReady) {
      wx.showToast({ title: '还在加载中', icon: 'none' });
      return;
    }
    this._navigated = true;
    playTap();
    wx.reLaunch({ url: '/pages/roof/index' });
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
