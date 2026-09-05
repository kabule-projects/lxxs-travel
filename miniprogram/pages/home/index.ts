import { HOME_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea, readCapsuleRect } from '../../utils/device';
import { emit, GameEvent, on } from '../../utils/event-bus';
import { getRiceStars, getStars, isTraveling } from '../../store/user';
import { playTap } from '../../services/sound';
import { navigateTo } from '../../utils/nav';
import { startTrip, type TripLoadout } from '../../services/trip';
import { setLocalTraveling } from '../../services/postcard';
import {
  resolveTripSyncView,
  runReturnBannerFlow,
  runDepartBannerFlow,
  scheduleReturnWatch,
  stopReturnWatch,
  clearTripBannerTimer,
} from '../../services/trip-return';

type HomeAssets = Record<keyof typeof HOME_ASSETS, string>;

Page({
  data: {
    stars: 0,
    riceStars: 0,
    showTravelBanner: false,
    travelBannerMode: 'depart' as 'depart' | 'return',
    /** 顶栏 top：胶囊按钮底边 + 间距，避开右上角关闭/菜单 */
    hudTop: 0,
    /** 底栏 bottom：安全区上沿 + 间距 */
    footerBottom: 0,
    assets: {} as HomeAssets,
    showBag: false,
    showSettings: false,
  },

  _offHidden: null as (() => void) | null,
  _offVisible: null as (() => void) | null,
  _offStars: null as (() => void) | null,
  _offReturned: null as (() => void) | null,
  _offStarted: null as (() => void) | null,

  onLoad() {
    const safe = readSafeArea();
    const capsule = readCapsuleRect();
    this.setData({
      // 顶栏整体落到胶囊下方，避开右上角关闭/菜单按钮
      hudTop: capsule.bottom + 12,
      // 底栏贴安全区上沿，底部留间距
      footerBottom: Math.max(safe.bottom, 16) + 8,
      stars: getStars(),
      riceStars: getRiceStars(),
    });
    this.loadAssets();
    this.bindEvents();
  },

  onUnload() {
    this._offHidden?.();
    this._offVisible?.();
    this._offStars?.();
    this._offReturned?.();
    this._offStarted?.();
    clearTripBannerTimer();
    stopReturnWatch();
  },

  onShow() {
    this.syncWallet();
    this.syncTripState();
  },

  syncWallet() {
    this.setData({
      stars: getStars(),
      riceStars: getRiceStars(),
    });
  },

  async syncTripState() {
    try {
      const view = await resolveTripSyncView();
      this.applyTripSyncView(view);
      if (view.sync.souvenirGranted) {
        wx.showToast({ title: '收到伴手礼', icon: 'none' });
      }
    } catch {
      /* ignore */
    }
  },

  applyTripSyncView(view: Awaited<ReturnType<typeof resolveTripSyncView>>) {
    const { banner, sync } = view;
    if (banner.mode === 'return' && sync.trip?._id) {
      this.showReturnBanner(sync.trip._id);
      return;
    }
    this.setData({
      showTravelBanner: false,
    });
  },

  showDepartBanner() {
    this.setData({
      showTravelBanner: true,
      travelBannerMode: 'depart',
    });
    runDepartBannerFlow(() => {
      this.setData({ showTravelBanner: false });
    });
  },

  showReturnBanner(tripId: string) {
    this.setData({
      showTravelBanner: true,
      travelBannerMode: 'return',
    });
    runReturnBannerFlow(tripId, () => {
      this.setData({ showTravelBanner: false });
    });
  },

  bindEvents() {
    this._offHidden = on(GameEvent.CHARACTER_HIDDEN, () => {
      this.showDepartBanner();
    });
    this._offVisible = on(GameEvent.CHARACTER_VISIBLE, () => {
      if (!isTraveling()) {
        this.setData({ showTravelBanner: false });
      }
    });
    this._offStars = on(GameEvent.STARS_UPDATED, () => {
      this.syncWallet();
    });
    this._offReturned = on(GameEvent.TRIP_RETURNED, (payload) => {
      const trip = (payload as { trip?: { _id?: string; status?: string } })?.trip;
      if (trip?.status === 'returned' && trip._id) {
        this.showReturnBanner(trip._id);
      }
    });
    this._offStarted = on(GameEvent.TRIP_STARTED, (payload) => {
      const endAt = (payload as { endAt?: number })?.endAt;
      if (endAt) {
        scheduleReturnWatch(endAt, () => this.syncTripState());
      }
    });
  },

  async loadAssets() {
    const assets = await resolveAssetMap(HOME_ASSETS);
    this.setData({ assets });
  },

  onTapBag() {
    playTap();
    if (isTraveling()) {
      wx.showToast({ title: '小深出门旅行了', icon: 'none' });
      return;
    }
    this.setData({ showBag: true });
  },

  onTapPrepare() {
    playTap();
    this.onTapBag();
  },

  onCloseBag() {
    this.setData({ showBag: false });
  },

  onTapSettings() {
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  /** 准备 → 填背包 → 出发 → 提示框 */
  async onBagDepart(e: WechatMiniprogram.CustomEvent) {
    playTap();
    const loadout = (e.detail as { loadout?: TripLoadout }).loadout;
    if (!loadout) return;
    try {
      await startTrip(loadout);
      this.setData({ showBag: false });
      setLocalTraveling(true);
      emit(GameEvent.CHARACTER_HIDDEN);
    } catch (err) {
      wx.showToast({
        title: (err as Error).message || '出发失败',
        icon: 'none',
      });
    }
  },

  onTapShop() {
    playTap();
    navigateTo('/pages/shop/index');
  },

  onTapGacha() {
    playTap();
    navigateTo('/pages/gacha/index');
  },

  onTapShowcase() {
    playTap();
    navigateTo('/pages/showcase/index');
  },

  /** 点击窗户 → 进入屋顶页 */
  onTapWindow() {
    playTap();
    navigateTo('/pages/roof/index');
  },

  /** 衣柜交互 Phase2 再开放 */
  // onTapWardrobe() {}

  onTapDiary() {
    playTap();
    navigateTo('/pages/diary/index');
  },
});
