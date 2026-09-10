import { SHOWCASE_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readCapsuleRect } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import GAME from '../../utils/constants';
import {
  listShowcase,
  type ShowcaseItemView,
} from '../../services/showcase';

type PageAssets = Record<keyof typeof SHOWCASE_ASSETS, string>;

interface SlotView {
  id: string;
  name: string;
  icon: string;
  description: string;
  empty: boolean;
}

interface ShelfPage {
  shelves: SlotView[][];
}

function emptySlot(): SlotView {
  return { id: '', name: '', icon: '', description: '', empty: true };
}

function buildPages(items: ShowcaseItemView[]): {
  pages: ShelfPage[];
  totalPages: number;
} {
  const pageSize = GAME.SHOWCASE_PAGE_SIZE;
  const shelves = GAME.SHOWCASE_SHELVES;
  const perShelf = GAME.SHOWCASE_PER_SHELF;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const pages: ShelfPage[] = [];

  for (let p = 0; p < totalPages; p += 1) {
    const slice = items.slice(p * pageSize, p * pageSize + pageSize);
    const shelfRows: SlotView[][] = [];
    for (let s = 0; s < shelves; s += 1) {
      const row: SlotView[] = [];
      for (let c = 0; c < perShelf; c += 1) {
        const item = slice[s * perShelf + c];
        if (item) {
          row.push({
            id: item.id,
            name: item.name,
            icon: item.icon,
            description: item.description,
            empty: false,
          });
        } else {
          row.push(emptySlot());
        }
      }
      shelfRows.push(row);
    }
    pages.push({ shelves: shelfRows });
  }

  return { pages, totalPages };
}

Page({
  data: {
    /** 顶栏 padding-top：胶囊按钮底边 + 间距，避开右上角关闭/菜单 */
    hudTop: 0,
    /** 柜子区域像素矩形：真机上百分比高度链会失效（同 shop/diary），按屏显内联 px */
    cabStyle: '',
    assets: {} as PageAssets,
    pages: [] as ShelfPage[],
    pageIndex: 0,
    totalPages: 1,
    detailVisible: false,
    detailTitle: '',
    detailImage: '',
    detailDesc: '',
    showSettings: false,
  },

  _items: [] as ShowcaseItemView[],

  onLoad() {
    const capsule = readCapsuleRect();
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.windowWidth || 375;
    const screenH = info.windowHeight || 667;
    // 顶栏整体落到胶囊下方，避开右上角关闭/菜单按钮（同 home/roof）
    this.setData({
      hudTop: capsule.bottom + 12,
      // 柜子区：左 15%、上 26%、宽 70%（与原调试网格对位参数一致），高度 54% 容纳 4 行
      cabStyle: `left: ${screenW * 0.15}px; top: ${screenH * 0.21}px; width: ${screenW * 0.7}px; height: ${screenH * 0.60}px;`,
    });
    this.loadAssets();
    this.reload();
  },

  async loadAssets() {
    const assets = await resolveAssetMap(SHOWCASE_ASSETS);
    this.setData({ assets });
  },

  applyItems(items: ShowcaseItemView[]) {
    this._items = items || [];
    const built = buildPages(this._items);
    this.setData({
      pages: built.pages,
      totalPages: built.totalPages,
      pageIndex: 0,
    });
  },

  async reload() {
    // 数据由 loading 预取 + 旅行回家时刷新维护，进页面只读缓存，不再发起请求
    try {
      const res = await listShowcase();
      this.applyItems(res.items || []);
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '加载失败',
        icon: 'none',
      });
    }
  },

  onTapBack() {
    playTap();
    navigateBack('/pages/home/index');
  },

  onTapSettings() {
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  onSwiperChange(e: WechatMiniprogram.CustomEvent) {
    const current = (e.detail as { current?: number }).current || 0;
    this.setData({ pageIndex: current });
  },

  onTapItem(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    const item = this._items.find((i) => i.id === id);
    if (!item) return;
    playTap();
    this.setData({
      detailVisible: true,
      detailTitle: item.name,
      detailImage: item.icon || '',
      detailDesc: item.description || '',
    });
  },

  onCloseDetail() {
    this.setData({ detailVisible: false });
  },
});
