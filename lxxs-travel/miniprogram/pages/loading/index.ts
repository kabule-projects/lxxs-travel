import { isSupportedOrDevtools, readSafeArea } from '../../utils/device';
import {
  assetWebp,
  assetWebpCandidates,
  LOADING_ASSETS,
  ROOF_SCENE_ASSETS,
  preloadFirstAvailable,
} from '../../utils/asset-path';

import { checkSession, registerProfile, uploadAvatar } from '../../services/auth';
import { setProfile } from '../../store/user';
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
    safeTop: 0,
    safeBottom: 0,
    showAuth: false,
    profileReady: false,
  },

  _bootDone: false,
  _layerCount: 0,
  _targetLayerCount: 1,

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

    if (app.globalData.cloudReady) {
      try {
        await this.tickProgress(60, '连接云端…');
        const profile = await checkSession();
        if (profile.needsProfile || !profile.userId) {
          this.setData({ showAuth: true, profileReady: false });
          await this.tickProgress(85, '等待授权…');
        } else {
          setProfile(profile);
          this.setData({ profileReady: true });
          await this.tickProgress(85, '同步数据…');
        }
      } catch {
        this.setData({ showAuth: true, profileReady: false });
        await this.tickProgress(85, '等待授权…');
      }
    } else {
      this.setData({ showAuth: true, profileReady: false });
      await this.tickProgress(85, '等待授权…');
    }

    this._bootDone = true;
    if (!this.data.layersReady) {
      this.setData({ layersReady: true });
    }
    await this.tryFinishBoot();
  },

  async tryFinishBoot() {
    if (!this._bootDone || !this.data.layersReady || !this.data.profileReady) return;
    await this.tickProgress(100, '');
    this.setData({ canEnter: true, tip: '' });
  },

  async onAuthSubmit(e: WechatMiniprogram.CustomEvent) {
    const { nickName, avatarUrl } = (e.detail || {}) as {
      nickName?: string;
      avatarUrl?: string;
    };
    if (!nickName?.trim()) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    playTap();
    wx.showLoading({ title: '注册中…' });
    try {
      let avatar = avatarUrl || '';
      const tempProfile = await registerProfile({ nickName: nickName.trim(), avatarUrl: '' });
      if (avatar && tempProfile.userId) {
        avatar = await uploadAvatar(avatar, tempProfile.userId);
        if (avatar !== avatarUrl) {
          await registerProfile({ nickName: nickName.trim(), avatarUrl: avatar });
        }
      }
      this.setData({ showAuth: false, profileReady: true });
      await this.tryFinishBoot();
    } catch (err) {
      wx.showToast({
        title: (err as Error).message || '注册失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  onEnterGame() {
    if (!this.data.profileReady) {
      wx.showToast({ title: '请先完成授权', icon: 'none' });
      return;
    }
    if (!this.data.canEnter) {
      wx.showToast({ title: '还在加载中', icon: 'none' });
      return;
    }
    playTap();
    wx.reLaunch({ url: '/pages/roof/index' });
  },
});

interface IAppOption {
  globalData: { supported: boolean; cloudReady: boolean };
}
