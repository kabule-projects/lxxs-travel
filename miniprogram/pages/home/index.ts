import { HOME_ASSETS, SHOP_ASSETS, SHOWCASE_ASSETS, assetCdnBase } from '../../utils/asset-path';
import { preloadAssetKeys } from '../../utils/preload';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea, readCapsuleRect } from '../../utils/device';
import { emit, GameEvent, on } from '../../utils/event-bus';
import { getRiceStars, getStars, isTraveling } from '../../store/user';
import { playSfx, playTap, playBgm } from '../../services/sound';
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
  dismissReturnBanner,
} from '../../services/trip-return';

type HomeAssets = Record<keyof typeof HOME_ASSETS, string>;

/** 房间小猫贴图（gif 转的动图 webp，无 dpr 变体，直接走不带后缀的 CDN 路径） */
const CAT_URLS = ['ss_lie', 'ss_sit', 'ss_sleep', 'ss_stand'].map((n) =>
  assetCdnBase(`home/cats/${n}`),
);

/** 三个出没点（视口百分比，中心锚点）：床上 / 床脚 / 桌子底下 */
const CAT_SPOTS = [
  { left: 17.9, top: 73.9 },
  { left: 54.8, top: 64.5 },
  { left: 80.1, top: 76.5 },
];

/** 停留时长范围（ms）：随机一段时间后换位置并换一只 */
const CAT_STAY_MIN = 15000;
const CAT_STAY_MAX = 35000;
const CAT_FADE_MS = 450;

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
    showInv: false,
    showSettings: false,
    /** 房间小猫：当前贴图 / 定位内联样式 / 是否淡入显示 */
    catSrc: '',
    catStyle: '',
    catShow: false,
  },

  _catTimer: 0 as number,
  _catSwapTimer: 0 as number,
  _catSpot: -1 as number,
  _catIdx: -1 as number,

  _offHidden: null as (() => void) | null,
  _offVisible: null as (() => void) | null,
  _offStars: null as (() => void) | null,
  _offReturned: null as (() => void) | null,
  _offStarted: null as (() => void) | null,
  /** 当前回家横幅对应的行程 id（点击立即收下时用） */
  _bannerTripId: null as string | null,
  /** 进入其他页面的预载/跳转进行中，防止连点堆叠 */
  _entering: false as boolean,

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
    this.stopCat();
  },

  onShow() {
    playBgm('room');
    this.syncWallet();
    this.syncTripState();
    this.startCat();
  },

  onHide() {
    this.stopCat();
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
    this._bannerTripId = null;
    this.setData({
      showTravelBanner: true,
      travelBannerMode: 'depart',
    });
    runDepartBannerFlow(() => {
      this.setData({ showTravelBanner: false });
    });
  },

  showReturnBanner(tripId: string) {
    this._bannerTripId = tripId;
    this.setData({
      showTravelBanner: true,
      travelBannerMode: 'return',
    });
    runReturnBannerFlow(tripId, () => {
      this.setData({ showTravelBanner: false });
    });
  },

  /** 点击横幅：立即收下并隐藏（回家横幅）或直接隐藏（出门横幅） */
  onBannerDismiss() {
    const tripId = this._bannerTripId;
    if (this.data.travelBannerMode === 'return' && tripId) {
      dismissReturnBanner(tripId, () => {
        this._bannerTripId = null;
        this.setData({ showTravelBanner: false });
      });
      return;
    }
    clearTripBannerTimer();
    this.setData({ showTravelBanner: false });
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

  /* ── 房间小猫：随机点位 + 随机一只，停留随机时长后淡出→换位置换猫→淡入 ── */

  startCat() {
    if (this._catTimer) return;
    // 首次出现稍快（1~2s），之后按停留区间随机
    this._catTimer = setTimeout(() => this.appearCat(true), 1000 + Math.random() * 1000) as unknown as number;
  },

  stopCat() {
    if (this._catTimer) clearTimeout(this._catTimer);
    if (this._catSwapTimer) clearTimeout(this._catSwapTimer);
    this._catTimer = 0;
    this._catSwapTimer = 0;
  },

  pickOther(cur: number, len: number) {
    if (len <= 1) return 0;
    let next = Math.floor(Math.random() * len);
    while (next === cur) next = Math.floor(Math.random() * len);
    return next;
  },

  /** 小猫现身：换点位/换猫（first 时从无到有不走淡出） */
  appearCat(first: boolean) {
    const spot = this.pickOther(this._catSpot, CAT_SPOTS.length);
    const idx = this.pickOther(this._catIdx, CAT_URLS.length);
    this._catSpot = spot;
    this._catIdx = idx;
    const apply = () => {
      const s = CAT_SPOTS[this._catSpot];
      this.setData({
        catSrc: CAT_URLS[this._catIdx],
        catStyle: `left: ${s.left}%; top: ${s.top}%;`,
        catShow: true,
      });
    };
    if (first) {
      apply();
    } else {
      this.setData({ catShow: false });
      this._catSwapTimer = setTimeout(() => {
        this._catSwapTimer = 0;
        apply();
      }, CAT_FADE_MS) as unknown as number;
    }
    // 随机停留后再次换位置换猫
    const stay =
      CAT_STAY_MIN + Math.random() * (CAT_STAY_MAX - CAT_STAY_MIN);
    this._catTimer = setTimeout(() => {
      this.appearCat(false);
    }, stay + (first ? 0 : CAT_FADE_MS)) as unknown as number;
  },

  onTapBag() {
    playTap();
    if (isTraveling()) {
      wx.showToast({ title: '小深出门旅行了', icon: 'none' });
      return;
    }
    this.setData({ showBag: true });
  },

  onTapItems() {
    playTap();
    this.setData({ showInv: true });
  },

  onCloseInv() {
    this.setData({ showInv: false });
  },

  onSelectInv() {
    wx.showToast({ title: '已选择', icon: 'none' });
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
    this.enterAfterPreload('/pages/shop/index', Object.values(SHOP_ASSETS));
  },

  onTapGacha() {
    playTap();
    navigateTo('/pages/gacha/index');
  },

  onTapShowcase() {
    playSfx('showcase_open');
    this.enterAfterPreload('/pages/showcase/index', Object.values(SHOWCASE_ASSETS));
  },

  /** 预载目标页 UI 资产后再跳转，避免落地逐张闪图；5s 兜底不阻塞 */
  async enterAfterPreload(url: string, keys: string[]) {
    if (this._entering) return;
    this._entering = true;
    wx.showLoading({ title: '加载中', mask: true });
    try {
      await preloadAssetKeys(keys, 5000);
    } finally {
      wx.hideLoading();
    }
    navigateTo(url);
    // 等页面推入动画落地后复位，覆盖 hideLoading 后、动画前的可点窗口
    setTimeout(() => {
      this._entering = false;
    }, 600);
  },

  /** 点击窗户 → 进入屋顶页 */
  onTapWindow() {
    playSfx('window');
    navigateTo('/pages/roof/index');
  },

  /** 衣柜交互 Phase2 再开放 */
  // onTapWardrobe() {}

  onTapDiary() {
    playSfx('diary_open');
    navigateTo('/pages/diary/index');
  },
});
