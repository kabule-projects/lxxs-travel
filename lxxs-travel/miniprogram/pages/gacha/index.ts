import { GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { getStars, setStars } from '../../store/user';
import GAME from '../../utils/constants';
import {
  drawGacha,
  gachaCost,
  listGachaCatalog,
  type GachaCatalogItem,
  type GachaDrawItem,
} from '../../services/gacha';

type GachaAssets = Record<keyof typeof GACHA_ASSETS, string>;

Page({
  data: {
    safeTop: 0,
    safeBottom: 0,
    assets: {} as GachaAssets,
    stars: 0,
    drawCount: 1 as 1 | 5,
    cost: GAME.GACHA_COST,
    spinning: false,
    showResult: false,
    showPrizes: false,
    drawResults: [] as GachaDrawItem[],
    catalog: [] as GachaCatalogItem[],
    showSettings: false,
  },

  _spinTimer: 0 as number,
  _drawing: false,
  _pendingCount: 1 as 1 | 5,

  onLoad() {
    const safe = readSafeArea();
    this.setData({
      safeTop: Math.max(safe.top, 16),
      safeBottom: Math.max(safe.bottom, 16),
      stars: getStars(),
      cost: gachaCost(1),
    });
    this.loadAssets();
    this.reloadCatalog();
  },

  onUnload() {
    if (this._spinTimer) clearTimeout(this._spinTimer);
  },

  async loadAssets() {
    const assets = await resolveAssetMap(GACHA_ASSETS);
    this.setData({ assets });
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

  onSelectCount(e: WechatMiniprogram.TouchEvent) {
    if (this.data.spinning) return;
    playTap();
    const count = Number(e.currentTarget.dataset.count) as 1 | 5;
    if (count !== 1 && count !== 5) return;
    this.setData({ drawCount: count, cost: gachaCost(count) });
  },

  onTapSpin() {
    if (this.data.spinning || this.data.showResult) return;
    playTap();
    const { drawCount, stars } = this.data;
    const cost = gachaCost(drawCount);
    if (stars < cost) {
      wx.showToast({
        title: drawCount > 1 ? '星星不足，无法五连' : '星星不足',
        icon: 'none',
      });
      return;
    }
    this.startSpin(drawCount);
  },

  onTapSkipSpin() {
    if (!this.data.spinning) return;
    if (this._spinTimer) clearTimeout(this._spinTimer);
    this._spinTimer = 0;
    this.finishSpin(this._pendingCount || 1);
  },

  startSpin(count: 1 | 5) {
    this._pendingCount = count;
    this.setData({ spinning: true });
    this._spinTimer = setTimeout(() => {
      this.finishSpin(count);
    }, 1800) as unknown as number;
  },

  async finishSpin(count: 1 | 5) {
    if (this._drawing) return;
    this._drawing = true;
    this._spinTimer = 0;
    this.setData({ spinning: false });
    try {
      const res = await drawGacha(count);
      setStars(res.stars);
      this.setData({
        stars: res.stars,
        drawResults: res.results,
        showResult: true,
      });
      this.reloadCatalog();
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '抽取失败',
        icon: 'none',
      });
    } finally {
      this._drawing = false;
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
