import { isSupportedOrDevtools, readSafeArea } from '../../utils/device';
import { assetWebp, assetCdnBase, LOADING_ASSETS, ROOF_SCENE_ASSETS, ROOF_ASSETS } from '../../utils/asset-path';
import { preloadImages } from '../../utils/preload';

import { ensureSession } from '../../services/auth';
import { getProfile } from '../../store/user';
import { playTap, playBgm, preloadSfx, preloadBgm } from '../../services/sound';
import { prefetchShowcase } from '../../services/showcase';
import { prefetchShop } from '../../services/shop';
import { prefetchGachaCatalog } from '../../services/gacha';

/** 进度条米子变装池：原皮 + 4 变装共五选一，各 20% */
const MI_SKINS = ['mi-1', 'mi-2', 'mi-3', 'mi-4'].map((n) =>
  assetCdnBase(`loading/mi-skins/${n}`),
);

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
    safeBottom: 0,
    sessionReady: false,
    /** 进度条米子图标：默认空走原皮，命中概率时替换为随机变装米 */
    barThumbSrc: '',
  },

  _bootDone: false,
  _layerCount: 0,
  _targetLayerCount: 1,
  _navigated: false,
  _entering: false,
  /** 本次启动的米子皮肤（onReady 时才写入 data，见下方注释） */
  _miSkin: '' as string,

  onLoad() {
    if (!isSupportedOrDevtools()) {
      wx.reLaunch({ url: '/pages/tollgate/index' });
      return;
    }

    const safe = readSafeArea();
    this.setData({
      safeBottom: Math.max(safe.bottom, 0),
    });
    // 本次启动的米子皮肤：原皮 + 4 变装五选一（各 20%），整段 loading 不变
    // 注意：必须在 onReady 才 setData——组件 attached 阶段读到的 thumbSrc 若是初始值，
    // 后续无变化不会触发组件 observer，皮肤不会被应用；onReady 在首次渲染后，
    // 属性变化必然触发 observer 换图
    this._miSkin =
      Math.random() < 0.2 ? '' : MI_SKINS[Math.floor(Math.random() * MI_SKINS.length)];

    this.resolveAssets().then(() => this.bootstrap());
    // 音效/BGM 本地化与启动流程并行，不阻塞进度条；播放时未就绪的单个回落 CDN
    void preloadSfx();
    void preloadBgm();
    playBgm('loading');
  },

  onReady() {
    this.setData({ barThumbSrc: this._miSkin });
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
      console.warn('[loading] session fail', e);
      // 云端连不上：直接报错并给重试入口，不再回落本地身份继续（避免本地/云端数据打架）
      // GM（admin）额外看到原始错误信息，便于现场定位
      const profile = getProfile();
      const rawMsg = (e as Error)?.message ? String((e as Error).message) : '';
      const content =
        profile?.gm && rawMsg
          ? `无法连接服务器，请检查网络后重试\n${rawMsg}`
          : '无法连接服务器，请检查网络后重试';
      wx.showModal({
        title: '连接失败',
        content,
        showCancel: false,
        confirmText: '重试',
        success: () => wx.reLaunch({ url: '/pages/loading/index' }),
      });
      return;
    }

    this._bootDone = true;
    if (!this.data.layersReady) {
      this.setData({ layersReady: true });
    }
    // 会话就绪后预取展示柜/商店/扭蛋图鉴数据 + 物品图，相应页面可秒开（失败不阻塞启动）
    void prefetchShowcase();
    void prefetchShop();
    void prefetchGachaCatalog();
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
