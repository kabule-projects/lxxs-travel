import { MEMO_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readCapsuleRect } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { listMemos, type MemoItem } from '../../services/memo';
import { toastCloudError } from '../../utils/net-error';

type MemoAssets = Record<keyof typeof MEMO_ASSETS, string>;

interface MemoRow {
  dateKey: string;
  preview: string;
}

const PAGE_SIZE = 20;
/** 列表预览最多显示的字数（超出截断加 ……） */
const PREVIEW_LEN = 12;

function makePreview(content: string): string {
  const flat = (content || '').replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LEN ? `${flat.slice(0, PREVIEW_LEN)}……` : flat;
}

Page({
  data: {
    assets: {} as MemoAssets,
    rows: [] as MemoRow[],
    /** 面板/行高（px）：onLoad 按屏幕换算内联，任何机型比例一致 */
    panelW: 0,
    panelH: 0,
    rowH: 0,
    backTop: 120,
    loaded: false,
    loadingMore: false,
    noMore: false,
  },

  _page: 1,
  _total: 0,

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.screenWidth || info.windowWidth || 375;
    const screenH = info.screenHeight || info.windowHeight || 667;
    const capsule = readCapsuleRect();
    // 面板按屏高定尺寸（mockup 占高约 79.5%），超宽机型回退按屏宽 90% 限制
    let panelH = screenH * 0.795;
    let panelW = panelH * (1183 / 2354);
    const maxW = screenW * 0.9;
    if (panelW > maxW) {
      panelW = maxW;
      panelH = panelW * (2354 / 1183);
    }
    const rowW = panelW * 0.86;
    this.setData({
      panelW,
      panelH,
      rowH: rowW * (135 / 1021),
      backTop: (capsule.bottom || 88) + 12,
    });
    resolveAssetMap(MEMO_ASSETS).then((assets) => {
      this.setData({ assets });
    });
    this.reload();
  },

  /** 拉第一页（进入页面/刷新用） */
  async reload() {
    this._page = 1;
    this._total = 0;
    try {
      const res = await listMemos(1, PAGE_SIZE);
      this._total = res.total || 0;
      this.setData({
        rows: (res.items || []).map((m: MemoItem) => ({
          dateKey: m.dateKey,
          preview: makePreview(m.content),
        })),
        loaded: true,
        noMore: (res.items || []).length >= this._total,
      });
    } catch (e) {
      this.setData({ loaded: true });
      toastCloudError('memo-list', '网络异常，记录加载失败');
    }
  },

  /** 滚动到底翻下一页 */
  async onLoadMore() {
    if (this.data.loadingMore || this.data.noMore || !this.data.loaded) return;
    this.setData({ loadingMore: true });
    try {
      const next = this._page + 1;
      const res = await listMemos(next, PAGE_SIZE);
      this._page = next;
      const more = (res.items || []).map((m: MemoItem) => ({
        dateKey: m.dateKey,
        preview: makePreview(m.content),
      }));
      this.setData({
        rows: [...this.data.rows, ...more],
        loadingMore: false,
        noMore: this.data.rows.length + more.length >= (res.total || this._total),
      });
    } catch {
      this.setData({ loadingMore: false });
      toastCloudError('memo-more', '网络异常，记录加载失败');
    }
  },

  /** 点开某天记录：编辑器 UI 尚未接入，先占位提示 */
  onTapRow(e: { currentTarget?: { dataset?: { key?: string } } }) {
    playTap();
    void e.currentTarget?.dataset?.key;
    wx.showToast({ title: '敬请期待', icon: 'none' });
  },

  onTapBack() {
    playTap();
    navigateBack('/pages/diary/index');
  },
});
