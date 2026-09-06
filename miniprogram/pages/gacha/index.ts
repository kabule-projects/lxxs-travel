import { GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea, readCapsuleRect } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { getStars, getRiceStars, setStars } from '../../store/user';
import { GameEvent, on } from '../../utils/event-bus';
import {
  drawGacha,
  gachaCost,
  listGachaCatalog,
  type GachaCatalogItem,
  type GachaDrawItem,
  type GachaDrawResult,
} from '../../services/gacha';

type GachaAssets = Record<keyof typeof GACHA_ASSETS, string>;

/** 抽扭蛋动图时长（ms）：需与 get_one / get_five 动图实际播放时长一致，到点衔接结果弹窗 */
const ANIM_MS: Record<1 | 5, number> = { 1: 6000, 5: 6000 };

Page({
  data: {
    /** 顶栏 top：胶囊底边 + 12px，避让右上角胶囊（同 home） */
    hudTop: 0,
    /** 底栏 bottom：安全区上沿 + 8px */
    footBottom: 0,
    assets: {} as GachaAssets,
    /** 扭蛋机当前贴图：常态静态图，抽奖时切对应动图 */
    machineSrc: '',
    stars: 0,
    riceStars: 0,
    spinning: false,
    showResult: false,
    showPrizes: false,
    drawResults: [] as GachaDrawItem[],
    catalog: [] as GachaCatalogItem[],
    showSettings: false,
  },

  _spinTimer: 0 as number,
  _drawing: false,
  /** 本次抽奖的进行中 Promise（与动图并行发起，动图播完/跳过时 await 它） */
  _drawPromise: null as Promise<GachaDrawResult> | null,
  _offStars: null as (() => void) | null,

  onLoad() {
    const safe = readSafeArea();
    const capsule = readCapsuleRect();
    this.setData({
      hudTop: capsule.bottom + 12,
      footBottom: Math.max(safe.bottom, 16) + 8,
    });
    this.syncWallet();
    this.loadAssets();
    this.reloadCatalog();
    this._offStars = on(GameEvent.STARS_UPDATED, () => {
      this.syncWallet();
    });
  },

  onShow() {
    this.syncWallet();
  },

  onUnload() {
    if (this._spinTimer) clearTimeout(this._spinTimer);
    this._offStars?.();
  },

  syncWallet() {
    this.setData({
      stars: getStars(),
      riceStars: getRiceStars(),
    });
  },

  async loadAssets() {
    const assets = await resolveAssetMap(GACHA_ASSETS);
    this.setData({ assets, machineSrc: assets.machine });
  },

  async reloadCatalog() {
    const catalog = await listGachaCatalog();
    this.setData({ catalog });
  },

  onTapBack() {
    playTap();
    navigateBack('/pages/shop/index');
  },

  onTapSettings() {
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  onTapDraw(e: WechatMiniprogram.TouchEvent) {
    if (this.data.spinning || this.data.showResult) return;
    playTap();
    const count = Number(e.currentTarget.dataset.count) as 1 | 5;
    if (count !== 1 && count !== 5) return;
    const { stars } = this.data;
    const cost = gachaCost(count);
    if (stars < cost) {
      wx.showToast({
        title: count > 1 ? '星星不足，无法五连' : '星星不足',
        icon: 'none',
      });
      return;
    }
    this.startSpin(count);
  },

  onTapSkipSpin() {
    if (!this.data.spinning) return;
    // 跳过动画：立即收尾（若抽奖请求未返回则等它返回，结果不丢）
    this.finishSpin();
  },

  startSpin(count: 1 | 5) {
    const { assets } = this.data;
    // 切对应动图开始播放；抽奖请求并行发起（后端按 requestId 幂等）
    this._drawPromise = drawGacha(count);
    this.setData({
      spinning: true,
      machineSrc: count === 5 ? assets.machineFive : assets.machineOne,
    });
    this._spinTimer = setTimeout(() => {
      this.finishSpin();
    }, ANIM_MS[count]) as unknown as number;
  },

  async finishSpin() {
    if (this._drawing || !this._drawPromise) return;
    this._drawing = true;
    if (this._spinTimer) clearTimeout(this._spinTimer);
    this._spinTimer = 0;
    try {
      const res = await this._drawPromise;
      setStars(res.stars);
      // 动图播完：切回静态常态图，衔接奖品弹窗
      this.setData({
        spinning: false,
        machineSrc: this.data.assets.machine,
        stars: res.stars,
        drawResults: res.results,
        showResult: true,
      });
      this.reloadCatalog();
    } catch (e) {
      this.setData({
        spinning: false,
        machineSrc: this.data.assets.machine,
      });
      wx.showToast({
        title: (e as Error).message || '抽取失败',
        icon: 'none',
      });
    } finally {
      this._drawing = false;
      this._drawPromise = null;
    }
  },

  onCloseResult() {
    this.setData({ showResult: false, drawResults: [] });
  },

  onConfirmResult() {
    playTap();
    this.setData({ showResult: false, drawResults: [] });
  },

  async onTapPrizes() {
    playTap();
    await this.reloadCatalog();
    this.setData({ showPrizes: true });
  },

  onClosePrizes() {
    this.setData({ showPrizes: false });
  },
});
