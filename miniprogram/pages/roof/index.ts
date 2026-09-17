import { ROOF_SCENE_ASSETS, ROOF_ASSETS, SHOP_ASSETS } from '../../utils/asset-path';
import { resolveAsset, resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea, readCapsuleRect } from '../../utils/device';
import { getProfile, getRiceStars, getStars, setRiceStars, setStars, isTraveling } from '../../store/user';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  measureGuideHost,
  notifyGuideBlocked,
  setGuideBackGuard,
} from '../../utils/guide-page';
import type { GuideHole } from '../../components/guide-overlay/guide-overlay';
import { playSfx, playTap, playBgm } from '../../services/sound';
import { navigateBack, navigateTo } from '../../utils/nav';
import { collectRoofStar, syncRoof } from '../../services/roof';
import { formatRemain, mergeRoofStars, withRemain, type RoofStarDisplay, type RoofStarView } from '../../utils/roof-logic';
import GAME from '../../utils/constants';
import { emit, GameEvent, on } from '../../utils/event-bus';
import { startTrip, claimHome, type TripLoadout } from '../../services/trip';
import { preloadOtherPagesAssets, preloadAssetKeys } from '../../utils/preload';
import {
  resolveTripSyncView,
  runReturnBannerFlow,
  runDepartBannerFlow,
  scheduleReturnWatch,
  stopReturnWatch,
  clearTripBannerTimer,
  dismissReturnBanner,
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
    /** 顶栏 top：胶囊按钮底边 + 间距，避开右上角关闭/菜单 */
    hudTop: 0,
    /** 底栏 bottom：安全区上沿 + 间距 */
    footerBottom: 0,
    assets: {} as RoofAssets,
    starItems: [] as RoofStarDisplay[],
    plusOneVisible: false,
    plusOneSeq: 0,
    showBag: false,
    showInv: false,
    pigeonState: 'idle' as PigeonState,
    /** 首次信箱同步完成前不渲染鸽子，避免旅行中鸽子按默认态闪现 */
    pigeonReady: false,
    flyAway: false,
    /** depart（旅行中）状态下隐藏小深 */
    charShenVisible: true,
    showMailbox: false,
    showSettings: false,
    mailItems: [] as MailItem[],
    mailCap: GAME.PIGEON_MAIL_CAP,
    /** 未读达上限时显示「满」图，否则 NEW */
    mailFull: false,
    showTravelBanner: false,
    travelBannerMode: 'depart' as 'depart' | 'return',
    /** 新手指引遮罩 */
    guideVisible: false,
    guideHoles: [] as GuideHole[],
    guideHit: null as { x: number; y: number; w: number; h: number } | null,
    guideText: '',
  },

  _tick: 0 as number,
  _plusTimer: 0 as number,
  _flyTimer: 0 as number,
  _pending: [] as RoofStarView[],
  _dropped: [] as RoofStarView[],
  _offReturned: null as (() => void) | null,
  _offStarted: null as (() => void) | null,
  _offVisible: null as (() => void) | null,
  /** 当前回家横幅对应的行程 id（点击立即收下时用） */
  _bannerTripId: null as string | null,
  /** 进入商店的预载/跳转进行中，防止连点堆叠 */
  _entering: false as boolean,
  /** 新手指引状态订阅退订函数 */
  _offGuide: null as (() => void) | null,
  /** sync 返回的未收取教学星数量 */
  _guideDropped: 0,
  /** 本次指引会话中已真实拾取的教学星数（捡满 9 颗才允许离开 roof-stars 步） */
  _guideCollected: 0,
  /** 教学星总数：8 普通 + 1 米（与云端/本地播种口径一致） */
  _guideTotal: 9,
  /** 上一次渲染的指引步骤，步骤切换时先全屏阻挡再重测，防旧孔闪现 */
  _guideStep: '' as string,
  _guideTimer: 0 as number,
  _guideBlockedAt: 0 as number,

  onLoad() {
    const safe = readSafeArea();
    const capsule = readCapsuleRect();
    this.setData({
      // 顶栏整体落到胶囊下方，避开右上角关闭/菜单按钮
      hudTop: capsule.bottom + 12,
      // 底栏贴安全区上沿，底部留间距
      footerBottom: Math.max(safe.bottom, 16) + 8,
    });
    this.loadAssets();
    this.bindTripEvents();
    this._offGuide = guide.onChange(() => {
      this.refreshGuide();
    });
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
      this.setData({ charShenVisible: false });
      if (endAt) {
        scheduleReturnWatch(endAt, () => this.syncTripState());
      }
    });
    this._offVisible = on(GameEvent.CHARACTER_VISIBLE, () => {
      this.setData({ charShenVisible: true });
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
      charShenVisible: true,
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

  async syncTripState() {
    try {
      const view = await resolveTripSyncView();
      const { banner, sync } = view;
      if (banner.mode === 'return' && sync.trip?._id) {
        this.showReturnBanner(sync.trip._id);
        return;
      }
      this.setData({ showTravelBanner: false });
    } catch {
      /* ignore */
    }
  },

  onShow() {
    playBgm('roof');
    // 未完成指引的用户冷启动落到屋顶即激活，固定从首步开始
    if (guide.initFromProfile(getProfile())) {
      guide.start();
    }
    // 自愈：指引已进行到商店阶段却回到屋顶（用户在系统返回弹窗选了离开），自动带回商店
    if (
      guide.isStep('shop-select', 'shop-buy', 'shop-to-gacha', 'gacha-draw', 'gacha-result')
    ) {
      navigateTo('/pages/shop/index');
    }
    this.refreshGuide();
    this.setData({
      stars: getStars(),
      riceStars: getRiceStars(),
      // 旅行中（含返回后未确认回家前）屋顶不显示小深
      charShenVisible: !isTraveling(),
    });
    this.syncFromServer();
    this.syncMailboxState();
    this.syncTripState();
    this.startTick();
    // 首屏渲染后延迟预热其他页面 UI 资产（会话内一次），避免与屋顶自身图片抢网络
    setTimeout(() => preloadOtherPagesAssets(), 2000);
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
    this._offVisible?.();
    this._offGuide?.();
    if (this._guideTimer) clearTimeout(this._guideTimer);
    setGuideBackGuard(false);
    clearTripBannerTimer();
    stopReturnWatch();
  },

  async loadAssets() {
    const [bgSrc, assets] = await Promise.all([
      resolveAsset(ROOF_SCENE_ASSETS.bg),
      resolveAssetMap(ROOF_ASSETS),
    ]);
    this.setData({ bgSrc, assets });
    // 预载起飞动图，出发瞬间即解码播放，不出现首帧空档
    wx.getImageInfo({ src: assets.pigeonFly, fail: () => {} });
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
      // 教学星剩余数：优先用 sync 计数，旧云函数兜底按 dropped guide 标记统计
      this._guideDropped =
        typeof res.guideDropped === 'number'
          ? res.guideDropped
          : dropped.filter((s) => s.guide).length;
      this.setData({
        stars: res.stars,
        riceStars: res.riceStars,
        starItems: mergeRoofStars(pending, dropped),
      });
      // 注意：roof-stars 步绝不能因 sync 返回 0 颗教学星而自动跳过——
      // 老账号/云函数未更新时教学星可能尚未播种或标记缺失，自动跳步会让玩家看不到完整流程。
      // 该步只允许由 onCollectStar 捡满 9 颗真实教学星推进。
      this.refreshGuide();
    } catch (e) {
      console.warn('[roof] sync fail', e);
    }
  },

  async syncMailboxState() {
    try {
      const res = await syncMailbox();
      const mailCap = res.mailCap || GAME.PIGEON_MAIL_CAP;
      const mailItems = res.items || [];
      this.setData({
        pigeonReady: true,
        pigeonState: res.pigeonState,
        mailItems,
        mailCap,
        mailFull: mailItems.length >= mailCap,
      });
    } catch {
      // 同步失败也解除隐藏，避免鸽子永远不出现
      this.setData({ pigeonReady: true });
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
    // 指引中只允许拾取教学星（遮罩已物理限制，handler 双保险）
    if (guide.isStep('roof-stars') && !target.guide) return;

    playSfx('star');
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
      if (guide.isStep('roof-stars')) {
        // 能走到这里说明拾取的是教学星（非教学星在开头已被拦截）
        this._guideCollected += 1;
        const remain = this._dropped.filter((s) => s.guide).length;
        this._guideDropped = remain;
        if (this._guideCollected >= this._guideTotal) {
          // 只有真实捡满 9 颗才推进，避免任何 sync 时序误跳步
          guide.advance('roof-to-shop');
        } else {
          wx.nextTick(() => {
            void measureGuideHost('roof', this);
          });
        }
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
    if (guide.isActive()) return;
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
    if (guide.isActive()) return;
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  async onTapPigeon() {
    if (guide.isActive()) return;
    playTap();
    if (this.data.flyAway) return;
    if (this.data.pigeonState === 'away') {
      wx.showToast({ title: '鸽子跟小深出门了', icon: 'none' });
      return;
    }
    try {
      const res = await openMailbox();
      const mailCap = res.mailCap || GAME.PIGEON_MAIL_CAP;
      const mailItems = res.items || [];
      this.setData({
        showMailbox: true,
        mailItems,
        pigeonState: res.pigeonState,
        mailCap,
        mailFull: mailItems.length >= mailCap,
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
    if (!items) return;
    const mailCap = this.data.mailCap || GAME.PIGEON_MAIL_CAP;
    this.setData({
      mailItems: items,
      mailFull: items.length >= mailCap,
    });
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
      const mailCap = this.data.mailCap || GAME.PIGEON_MAIL_CAP;
      this.setData({
        mailItems,
        mailFull: mailItems.length >= mailCap,
      });
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
    if (guide.isActive()) return;
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

  /** 屋顶出发：鸽子飞走动画 → 空帽子，停留在屋顶（不再自动回小屋） */
  async onBagDepart(e: WechatMiniprogram.CustomEvent) {
    playSfx('pigeon_fly');
    const loadout = (e.detail as { loadout?: TripLoadout }).loadout;
    if (!loadout) return;
    try {
      await this.doDepart(loadout);
    } catch (err) {
      wx.showToast({
        title: (err as Error).message || '出发失败',
        icon: 'none',
      });
    }
  },

  /** 出发成功后的统一收尾：关背包、鸽飞走、隐藏小深、弹出门口横幅 */
  applyDepartSuccess() {
    this.setData({ showBag: false, flyAway: true, charShenVisible: false });
    setLocalTraveling(true);
    emit(GameEvent.CHARACTER_HIDDEN);
    this.showDepartBanner();
    this._flyTimer = setTimeout(() => {
      this.setData({ flyAway: false, pigeonState: 'away' });
    }, 1650) as unknown as number;
  },

  async doDepart(loadout: TripLoadout) {
    try {
      await startTrip(loadout);
      this.applyDepartSuccess();
      return;
    } catch (err) {
      // 云端还挂着未确认的归来（本地已脱钩）：先收下旧旅行再重试一次
      if ((err as Error & { code?: string }).code !== 'ALREADY_TRAVELING') throw err;
    }
    await claimHome();
    await startTrip(loadout);
    this.applyDepartSuccess();
  },

  async onTapShop() {
    // 指引中仅屋顶商店步骤放行
    if (guide.isActive() && !guide.isStep('roof-to-shop')) return;
    if (this._entering) return;
    this._entering = true;
    playTap();
    wx.showLoading({ title: '加载中', mask: true });
    try {
      await preloadAssetKeys(Object.values(SHOP_ASSETS), 5000);
    } finally {
      wx.hideLoading();
    }
    navigateTo('/pages/shop/index');
    setTimeout(() => {
      this._entering = false;
    }, 600);
  },

  onTapHome() {
    if (guide.isActive()) return;
    playTap();
    navigateBack('/pages/home/index');
  },

  /** 新手指引：按当前步骤刷新遮罩与开孔（roof 宿主） */
  refreshGuide() {
    // 每次（重新）进入捡星步骤：重置本会话拾取计数
    if (guide.isStep('roof-stars') && this._guideStep !== 'roof-stars') {
      this._guideCollected = 0;
    }
    refreshGuideHost('roof', this);
    setGuideBackGuard(guide.isHost('roof'));
  },

  /** 遮罩暗区被点击：节流提示（开孔抖动由组件处理） */
  onGuideBlocked() {
    notifyGuideBlocked(this);
  },
});
