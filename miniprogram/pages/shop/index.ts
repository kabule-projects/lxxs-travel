import { SHOP_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea, readCapsuleRect } from '../../utils/device';
import { playSfx, playTap, playBgm } from '../../services/sound';
import { navigateBack, navigateTo } from '../../utils/nav';
import { getRiceStars, getStars, setStars } from '../../store/user';
import GAME from '../../utils/constants';
import {
  canBuyItem,
  listShop,
  purchaseShop,
  type ShopItemView,
} from '../../services/shop';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  measureGuideHost,
  notifyGuideBlocked,
  setGuideBackGuard,
} from '../../utils/guide-page';
import type { GuideHole } from '../../components/guide-overlay/guide-overlay';

type ShopAssets = Record<keyof typeof SHOP_ASSETS, string>;

interface ShelfSlotView extends ShopItemView {
  empty?: boolean;
}

interface ShelfRow {
  slots: ShelfSlotView[];
}

interface PageSlot {
  shelves: ShelfRow[];
}

Page({
  data: {
    stars: 0,
    riceStars: 0,
    /** 顶栏 top：胶囊底边 + 12px，避让右上角胶囊（同 home/gacha） */
    hudTop: 0,
    /** 底栏 bottom：安全区上沿 + 间距 */
    footBottom: 0,
    /** 展示柜像素矩形：真机上百分比高度链（min-height 父级 + swiper height:100%）会失效，
     *  按屏显尺寸内联 px，保证 swiper 有确定高度（同 diary swiperH 的处理） */
    cabinetStyle: '',
    assets: {} as ShopAssets,
    showSettings: false,
    showInv: false,
    pageIndex: 0,
    totalPages: 1,
    pages: [] as PageSlot[],
    selectedId: '',
    selectedName: '',
    selectedDesc: '',
    buyEnabled: false,
    buying: false,
    /** 新手指引遮罩 */
    guideVisible: false,
    guideHoles: [] as GuideHole[],
    guideHit: null as { x: number; y: number; w: number; h: number } | null,
    guideText: '',
  },

  _allItems: [] as ShopItemView[],
  _offGuide: null as (() => void) | null,
  _guideStep: '' as string,
  _guideTimer: 0 as number,
  _guideBlockedAt: 0 as number,

  onLoad() {
    const safe = readSafeArea();
    const capsule = readCapsuleRect();
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.windowWidth || 375;
    const screenH = info.windowHeight || 667;
    this.setData({
      // 顶栏整体落到胶囊下方，避开右上角关闭/菜单按钮
      hudTop: capsule.bottom + 12,
      // 底栏贴安全区上沿，底部留间距
      footBottom: Math.max(safe.bottom, 16) + 8,
      // 展示柜矩形：与原 CSS 百分比一致（left/right 各 9%，top 42%，height 26%）
      cabinetStyle: `left: ${screenW * 0.09}px; top: ${screenH * 0.42}px; width: ${screenW * 0.82}px; height: ${screenH * 0.26}px;`,
      stars: getStars(),
      riceStars: getRiceStars(),
    });
    this.loadAssets();
    this.reloadList();
    this._offGuide = guide.onChange(() => {
      this.refreshGuide();
    });
  },

  onShow() {
    playBgm('room');
    this.setData({ stars: getStars(), riceStars: getRiceStars() });
    // 从屋顶进入：屋顶放行商店后由商店承接为选物步骤
    if (guide.isStep('roof-to-shop')) guide.advance('shop-select');
    // 自愈：指引已到扭蛋阶段却回到商店（系统返回弹窗选了离开），自动带回扭蛋
    if (guide.isStep('gacha-draw', 'gacha-result')) {
      navigateTo('/pages/gacha/index');
    }
    this.refreshGuide();
  },

  onUnload() {
    this._offGuide?.();
    if (this._guideTimer) clearTimeout(this._guideTimer);
    setGuideBackGuard(false);
  },

  async loadAssets() {
    const assets = await resolveAssetMap(SHOP_ASSETS);
    this.setData({ assets });
  },

  buildPages(items: ShopItemView[], preferPage = 0) {
    const pageSize = GAME.SHOP_PAGE_SIZE;
    const perShelf = 3;
    const shelvesPerPage = 2;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
    const pages: PageSlot[] = [];

    const emptySlot = (): ShelfSlotView => ({
      id: '',
      name: '',
      description: '',
      icon: '',
      price: 0,
      shopCategory: 'food',
      boughtToday: false,
      empty: true,
    });

    for (let p = 0; p < totalPages; p += 1) {
      const slice = items.slice(p * pageSize, p * pageSize + pageSize);
      const shelves: ShelfRow[] = [];
      for (let s = 0; s < shelvesPerPage; s += 1) {
        const row: ShelfSlotView[] = [];
        for (let c = 0; c < perShelf; c += 1) {
          const item = slice[s * perShelf + c];
          row.push(item ? { ...item, empty: false } : emptySlot());
        }
        shelves.push({ slots: row });
      }
      pages.push({ shelves });
    }

    const pageIndex = Math.min(Math.max(preferPage, 0), totalPages - 1);
    return { pages, totalPages, pageIndex };
  },

  applySelection(item: ShopItemView | null) {
    const stars = this.data.stars;
    this.setData({
      selectedId: item?.id || '',
      selectedName: item?.name || '',
      selectedDesc: item?.description || '',
      buyEnabled: canBuyItem(item, stars),
    });
  },

  async reloadList(preferPage = 0) {
    try {
      // 必须强制刷新：loading 阶段 prefetchShop 的缓存里带着进店前的旧余额，
      // 新手指引中屋顶刚捡的星星会被缓存的 0 星回写覆盖，导致买不起土豆卡死流程
      const res = await listShop(true);
      setStars(res.stars);
      this._allItems = res.items || [];
      const built = this.buildPages(this._allItems, preferPage);
      this.setData({
        stars: res.stars,
        pages: built.pages,
        totalPages: built.totalPages,
        pageIndex: built.pageIndex,
      });
      const selected =
        this._allItems.find((i) => i.id === this.data.selectedId) || null;
      this.applySelection(selected);
      // 列表渲染后重测指引开孔（第一格依赖列表数据）
      wx.nextTick(() => {
        void measureGuideHost('shop', this);
      });
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '商店加载失败',
        icon: 'none',
      });
    }
  },

  onTapBack() {
    if (guide.isActive()) return;
    playTap();
    navigateBack('/pages/home/index');
  },

  onTapGacha() {
    // 指引中仅扭蛋入口步骤放行
    // 防御：购买后的 advance 可能因时序未生效
    if (guide.isStep('shop-buy')) guide.advance('shop-to-gacha');
    if (guide.isActive() && !guide.isStep('shop-to-gacha')) return;
    playTap();
    navigateTo('/pages/gacha/index');
  },

  onTapSettings() {
    if (guide.isActive()) return;
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  onTapBag() {
    if (guide.isActive()) return;
    playTap();
    this.setData({ showInv: true });
  },

  onCloseInv() {
    this.setData({ showInv: false });
  },

  onSwiperChange(e: WechatMiniprogram.CustomEvent) {
    const current = (e.detail as { current?: number }).current || 0;
    // 指引中禁止翻页，弹回第一页
    if (guide.isActive() && current !== 0) {
      this.setData({ pageIndex: 0 });
      return;
    }
    this.setData({ pageIndex: current });
  },

  onTapItem(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    // 防御：onShow 的 advance 可能因某种时序未生效，点击时补推进
    if (guide.isStep('roof-to-shop')) guide.advance('shop-select');
    // 指引选物步：仅列表第一件（云端为 potato，本地兜底为种子首件）可点
    if (guide.isStep('shop-select')) {
      const anchorId = this._allItems[0]?.id;
      if (id !== anchorId) return;
      playTap();
      const item = this._allItems.find((i: ShopItemView) => i.id === id) || null;
      this.applySelection(item);
      guide.advance('shop-buy');
      return;
    }
    if (guide.isActive()) return;
    playTap();
    const item = this._allItems.find((i) => i.id === id) || null;
    this.applySelection(item);
  },

  async onTapBuy() {
    // 防御：onShow 或 onTapItem 的 advance 可能因时序未生效
    if (guide.isStep('shop-select')) guide.advance('shop-buy');
    if (guide.isActive() && !guide.isStep('shop-buy')) return;
    if (!this.data.buyEnabled || this.data.buying || !this.data.selectedId) {
      return;
    }
    playSfx('gacha_coin');
    this.setData({ buying: true });
    try {
      const res = await purchaseShop(this.data.selectedId);
      setStars(res.stars);
      // 教学购买不占每日额度：不标记 boughtToday，避免土豆变半透明
      const guideActive = guide.isActive();
      const updated = this._allItems.map((i) =>
        guideActive ? i : i.id === res.itemId ? { ...i, boughtToday: true } : i,
      );
      this._allItems = updated;
      const built = this.buildPages(updated, this.data.pageIndex);
      this.setData({
        stars: res.stars,
        pages: built.pages,
        totalPages: built.totalPages,
        pageIndex: built.pageIndex,
        buying: false,
      });
      const selected = updated.find((i) => i.id === res.itemId) || null;
      this.applySelection(selected);
      wx.showToast({ title: '购买成功', icon: 'success' });
      // 指引购买成功：引导去扭蛋
      if (guide.isStep('shop-buy')) guide.advance('shop-to-gacha');
    } catch (e) {
      this.setData({ buying: false });
      wx.showToast({
        title: (e as Error).message || '购买失败',
        icon: 'none',
      });
    }
  },

  /** 新手指引：按当前步骤刷新遮罩与开孔（shop 宿主） */
  refreshGuide() {
    refreshGuideHost('shop', this);
    setGuideBackGuard(guide.isHost('shop'));
  },

  /** 遮罩暗区被点击：节流提示 */
  onGuideBlocked() {
    notifyGuideBlocked(this);
  },
});
