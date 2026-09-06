import { SHOP_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack, navigateTo } from '../../utils/nav';
import { getRiceStars, getStars, setStars } from '../../store/user';
import GAME from '../../utils/constants';
import {
  canBuyItem,
  listShop,
  purchaseShop,
  type ShopItemView,
} from '../../services/shop';

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
    safeTop: 0,
    safeBottom: 0,
    assets: {} as ShopAssets,
    showSettings: false,
    pageIndex: 0,
    totalPages: 1,
    pages: [] as PageSlot[],
    selectedId: '',
    selectedName: '',
    selectedDesc: '',
    buyEnabled: false,
    buying: false,
  },

  _allItems: [] as ShopItemView[],

  onLoad() {
    const safe = readSafeArea();
    this.setData({
      safeTop: Math.max(safe.top, 16),
      safeBottom: Math.max(safe.bottom, 16),
      stars: getStars(),
      riceStars: getRiceStars(),
    });
    this.loadAssets();
    this.reloadList();
  },

  onShow() {
    this.setData({ stars: getStars(), riceStars: getRiceStars() });
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
      const res = await listShop();
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
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '商店加载失败',
        icon: 'none',
      });
    }
  },

  onTapBack() {
    playTap();
    navigateBack('/pages/home/index');
  },

  onTapGacha() {
    playTap();
    navigateTo('/pages/gacha/index');
  },

  onTapSettings() {
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  onTapBag() {
    playTap();
    wx.showToast({ title: '背包 · 请从主页准备', icon: 'none' });
  },

  onSwiperChange(e: WechatMiniprogram.CustomEvent) {
    const current = (e.detail as { current?: number }).current || 0;
    this.setData({ pageIndex: current });
  },

  onTapItem(e: WechatMiniprogram.TouchEvent) {
    playTap();
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    const item = this._allItems.find((i) => i.id === id) || null;
    this.applySelection(item);
  },

  async onTapBuy() {
    if (!this.data.buyEnabled || this.data.buying || !this.data.selectedId) {
      return;
    }
    playTap();
    this.setData({ buying: true });
    try {
      const res = await purchaseShop(this.data.selectedId);
      setStars(res.stars);
      const updated = this._allItems.map((i) =>
        i.id === res.itemId ? { ...i, boughtToday: true } : i,
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
    } catch (e) {
      this.setData({ buying: false });
      wx.showToast({
        title: (e as Error).message || '购买失败',
        icon: 'none',
      });
    }
  },
});
