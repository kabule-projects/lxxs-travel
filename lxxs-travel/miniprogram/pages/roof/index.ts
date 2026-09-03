import { ROOF_SCENE_ASSETS, ROOF_ASSETS } from '../../utils/asset-path';
import { resolveAsset, resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea } from '../../utils/device';
import { getRiceStars, getStars, setRiceStars, setStars, isTraveling } from '../../store/user';
import { playTap } from '../../services/sound';
import { navigateBack, navigateTo } from '../../utils/nav';
import { collectRoofStar, syncRoof } from '../../services/roof';
import { formatRemain, mergeRoofStars, withRemain, type RoofStarDisplay, type RoofStarView } from '../../utils/roof-logic';
import GAME from '../../utils/constants';
import { emit, GameEvent, on } from '../../utils/event-bus';
import { startTrip, type TripLoadout } from '../../services/trip';
import {
  resolveTripSyncView,
  runReturnBannerFlow,
  runDepartBannerFlow,
  scheduleReturnWatch,
  stopReturnWatch,
  clearTripBannerTimer,
  TRIP_BANNER_DEPART,
  TRIP_BANNER_RETURN,
} from '../../services/trip-return';
import {
  claimMail,
  openMailbox,
  setLocalTraveling,
  syncMailbox,
  type MailItem,
  type PigeonState,
} from '../../services/postcard';

type RoofAssets = Record<keyof typeof ROOF_ASSETS, string>;

Page({
  data: {
    stars: 0,
    riceStars: 0,
    bgSrc: '',
    safeTop: 0,
    safeBottom: 0,
    assets: {} as RoofAssets,
    starItems: [] as RoofStarDisplay[],
    plusOneVisible: false,
    plusOneSeq: 0,
    showBag: false,
    showInv: false,
    pigeonState: 'idle' as PigeonState,
    flyAway: false,
    showMailbox: false,
    showSettings: false,
    mailItems: [] as MailItem[],
    mailCap: GAME.PIGEON_MAIL_CAP,
    showTravelBanner: false,
    travelBannerText: '',
  },

  _tick: 0 as number,
  _plusTimer: 0 as number,
  _flyTimer: 0 as number,
  _pending: [] as RoofStarView[],
  _dropped: [] as RoofStarView[],
  _offReturned: null as (() => void) | null,
  _offStarted: null as (() => void) | null,

  onLoad() {
    const safe = readSafeArea();
    this.setData({
      safeTop: Math.max(safe.top, 12),
      safeBottom: Math.max(safe.bottom, 16),
    });
    this.loadAssets();
    this.bindTripEvents();
  },

  bindTripEvents() {
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

  showDepartBanner() {
    this.setData({
      showTravelBanner: true,
      travelBannerText: TRIP_BANNER_DEPART,
    });
    runDepartBannerFlow(() => {
      this.setData({ showTravelBanner: false, travelBannerText: '' });
    });
  },

  showReturnBanner(tripId: string, text = TRIP_BANNER_RETURN) {
    this.setData({
      showTravelBanner: true,
      travelBannerText: text,
    });
    runReturnBannerFlow(tripId, () => {
      this.setData({ showTravelBanner: false, travelBannerText: '' });
    });
  },

  async syncTripState() {
    try {
      const view = await resolveTripSyncView();
      const { banner, sync } = view;
      if (banner.mode === 'return' && sync.trip?._id) {
        this.showReturnBanner(sync.trip._id, banner.text);
        return;
      }
      this.setData({ showTravelBanner: false, travelBannerText: '' });
    } catch {
      /* ignore */
    }
  },

  onShow() {
    this.setData({
      stars: getStars(),
      riceStars: getRiceStars(),
    });
    this.syncFromServer();
    this.syncMailboxState();
    this.syncTripState();
    this.startTick();
  },

  onHide() {
    this.stopTick();
  },

  onUnload() {
    this.stopTick();
    if (this._plusTimer) clearTimeout(this._plusTimer);
    if (this._flyTimer) clearTimeout(this._flyTimer);
    this._offReturned?.();
    this._offStarted?.();
    clearTripBannerTimer();
    stopReturnWatch();
  },

  async loadAssets() {
    const [bgSrc, assets] = await Promise.all([
      resolveAsset(ROOF_SCENE_ASSETS.bg),
      resolveAssetMap(ROOF_ASSETS),
    ]);
    this.setData({ bgSrc, assets });
  },

  startTick() {
    this.stopTick();
    this._tick = setInterval(() => this.onTick(), 1000) as unknown as number;
  },

  stopTick() {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = 0;
    }
  },

  onTick() {
    const now = Date.now();
    const pending = this._pending;
    const due = pending.some((s) => s.dropAt <= now);
    if (due) {
      this.syncFromServer();
      return;
    }
    const nextPending = pending.map((s) => ({
      ...s,
      remainText: formatRemain(s.dropAt - now),
    }));
    this._pending = nextPending;
    this.setData({
      starItems: mergeRoofStars(nextPending, this._dropped),
    });
    /** 每 15s 拉一次信箱，赶上途中投递 */
    if (now % 15000 < 1000) {
      this.syncMailboxState();
    }
  },

  async syncFromServer() {
    try {
      const res = await syncRoof(getStars(), getRiceStars());
      const now = Date.now();
      setStars(res.stars);
      setRiceStars(res.riceStars);
      const pending = (res.pending || []).map((s) => withRemain(s, now));
      const dropped = (res.dropped || []).map((s) => withRemain(s, now));
      this._pending = pending;
      this._dropped = dropped;
      this.setData({
        stars: res.stars,
        riceStars: res.riceStars,
        starItems: mergeRoofStars(pending, dropped),
      });
    } catch (e) {
      console.warn('[roof] sync fail', e);
    }
  },

  async syncMailboxState() {
    try {
      const res = await syncMailbox();
      this.setData({
        pigeonState: res.pigeonState,
        mailItems: res.items,
        mailCap: res.mailCap || GAME.PIGEON_MAIL_CAP,
      });
    } catch {
      /* ignore */
    }
  },

  showPlusOne() {
    if (this._plusTimer) clearTimeout(this._plusTimer);
    this.setData({ plusOneVisible: false, plusOneSeq: this.data.plusOneSeq + 1 });
    wx.nextTick(() => {
      this.setData({ plusOneVisible: true });
      this._plusTimer = setTimeout(() => {
        this.setData({ plusOneVisible: false });
      }, GAME.STAR_PLUS_ONE_MS) as unknown as number;
    });
  },

  async onCollectStar(e: { detail?: { id?: string } }) {
    const id = e.detail?.id;
    if (!id) return;
    const target = this._dropped.find((s) => s.id === id);
    if (!target) return;

    playTap();
    const prevDropped = this._dropped;
    this._dropped = prevDropped.filter((s) => s.id !== id);
    this.setData({
      starItems: mergeRoofStars(this._pending, this._dropped),
    });

    try {
      const res = await collectRoofStar(id);
      setStars(res.stars);
      setRiceStars(res.riceStars);
      this.setData({ stars: res.stars, riceStars: res.riceStars });
      if (res.type !== 'rice') {
        this.showPlusOne();
        emit(GameEvent.STAR_COLLECTED, { id, type: res.type });
      }
    } catch {
      this._dropped = prevDropped;
      this.setData({
        starItems: mergeRoofStars(this._pending, this._dropped),
      });
      wx.showToast({ title: '收取失败', icon: 'none' });
    }
  },

  onTapItems() {
    playTap();
    this.setData({ showInv: true });
  },

  onCloseInv() {
    this.setData({ showInv: false });
  },

  onSelectInv(e: WechatMiniprogram.CustomEvent) {
    const name = (e.detail as { item?: { name?: string } })?.item?.name;
    wx.showToast({
      title: name ? `持有：${name}` : '已选择',
      icon: 'none',
    });
  },

  onTapSettings() {
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  async onTapPigeon() {
    playTap();
    if (this.data.flyAway) return;
    if (this.data.pigeonState === 'away') {
      wx.showToast({ title: '鸽子跟小深出门了', icon: 'none' });
      return;
    }
    try {
      const res = await openMailbox();
      this.setData({
        showMailbox: true,
        mailItems: res.items || [],
        pigeonState: res.pigeonState,
        mailCap: res.mailCap || GAME.PIGEON_MAIL_CAP,
      });
    } catch {
      this.setData({ showMailbox: true });
    }
  },

  onCloseMailbox() {
    this.setData({ showMailbox: false });
    this.syncMailboxState();
  },

  onMailItemsChange(e: WechatMiniprogram.CustomEvent) {
    const items = (e.detail as { items?: MailItem[] }).items;
    if (items) this.setData({ mailItems: items });
  },

  async onClaimMail(e: WechatMiniprogram.CustomEvent) {
    const item = (e.detail as { item?: MailItem }).item;
    if (!item) return;
    try {
      await claimMail(item.tripId, item.instanceId);
      emit(GameEvent.POSTCARD_CLAIMED, item);
      const mailItems = this.data.mailItems.filter(
        (m) => m.instanceId !== item.instanceId,
      );
      this.setData({ mailItems });
      wx.showToast({ title: '已收下', icon: 'success' });
      this.syncMailboxState();
    } catch (err) {
      wx.showToast({
        title: (err as Error).message || '领取失败',
        icon: 'none',
      });
    }
  },

  onTapPrepare() {
    playTap();
    if (isTraveling()) {
      wx.showToast({ title: '小深出门旅行了', icon: 'none' });
      return;
    }
    this.setData({ showBag: true });
  },

  onCloseBag() {
    this.setData({ showBag: false });
  },

  /** 屋顶出发：鸽子飞出走动画 → 空帽子 → 回小屋提示 */
  async onBagDepart(e: WechatMiniprogram.CustomEvent) {
    playTap();
    const loadout = (e.detail as { loadout?: TripLoadout }).loadout;
    if (!loadout) return;
    this.setData({ showBag: false, flyAway: true });
    try {
      await startTrip(loadout);
      setLocalTraveling(true);
      emit(GameEvent.CHARACTER_HIDDEN);
      this.showDepartBanner();
      this._flyTimer = setTimeout(() => {
        this.setData({ flyAway: false, pigeonState: 'away' });
        navigateBack('/pages/home/index');
      }, 950) as unknown as number;
    } catch (err) {
      this.setData({ flyAway: false });
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

  onTapHome() {
    playTap();
    navigateBack('/pages/home/index');
  },
});
