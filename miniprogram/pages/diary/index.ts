import { DIARY_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { playSfx, playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { listDiary, type DiaryEntry, type PostcardType } from '../../services/diary';

type PageAssets = Record<keyof typeof DIARY_ASSETS, string>;

/** 日记 tab 类型顺序与显示名；tab 数量 = 当前图鉴中实际出现的类型数（最多 4 个） */
const POSTCARD_TYPE_ORDER: PostcardType[] = ['postcard', 'letter', 'photo', 'special'];
const POSTCARD_TYPE_LABELS: Record<PostcardType, string> = {
  postcard: '明信片',
  letter: '信件',
  photo: '照片',
  special: '限定',
};

function formatDiaryDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function sortByClaimTime(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => a.firstClaimedAt - b.firstClaimedAt);
}

/** 每页格子数：3 列 × 5 行 */
const PAGE_SIZE = 15;
/** 翻页提示是否已展示过（全局只提示一次） */
const HINT_STORAGE_KEY = 'diary_flip_hint_shown';

/** 网格布局：3 列 × 5 行正方形格子，swiper 尺寸由格子大小推算，不能独立设宽高 */
const GRID_LEFT_PCT = 0.14;   // 左边距（相对 frame 宽）
const GRID_TOP_PCT = 0.29;    // 上边距（相对 frame 高）
/** 单个格子边长占屏幕宽度的比例；改这个直接放大/缩小所有格子 */
const GRID_CELL_PCT = 0.19;
/** 格子间距（rpx，与 wxss 的 gap 保持一致） */
const GRID_GAP_RPX = 48;

/** 将数组按固定大小切分为多页 */
function chunk<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size));
  }
  return pages;
}

Page({
  data: {
    assets: {} as PageAssets,
    /** 全部日记条目（不过滤），tab 切换时从中筛选 */
    allEntries: [] as DiaryEntry[],
    /** 当前图鉴实际出现的类型，决定显示几个 tab */
    tabs: [] as Array<{ type: PostcardType; label: string }>,
    activeTab: '' as PostcardType | '',
    entries: [] as DiaryEntry[],
    gridSlots: [] as Array<{
      key: string;
      entryIndex: number;
      imageThumb?: string;
      imageFull?: string;
    }>,
    /** 按页切分后的格子：每页 PAGE_SIZE 个，用于 swiper 左右翻页 */
    pages: [] as Array<
      Array<{
        key: string;
        entryIndex: number;
        imageThumb?: string;
        imageFull?: string;
      }>
    >,
    currentPage: 0,
    /** swiper 像素尺寸/位置：由格子大小推算，内联设置确保原生组件正确布局 */
    swiperLeft: 0,
    swiperTop: 0,
    swiperW: 0,
    swiperH: 600,
    /** 是否展示翻页提示贴图（首次收集超过一页时显示，点击关闭后不再出现） */
    showHint: false,
    empty: true,
    zoomVisible: false,
    letterVisible: false,
    zoomImage: '',
    zoomTitle: '',
    letterDate: '',
    letterStory: '',
  },

  onLoad() {
    // swiper 是原生组件，必须内联明确的 px 尺寸/位置。
    // 3×4 正方形格子 → swiper 宽 = 3×格子+2×间距，高 = 4×格子+3×间距，宽高比由格子锁定
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.screenWidth || info.windowWidth || 375;
    const frameH = (screenW * 4330) / 2002;
    const cell = screenW * GRID_CELL_PCT;
    const gap = (screenW * GRID_GAP_RPX) / 750;
    this.setData({
      swiperLeft: screenW * GRID_LEFT_PCT,
      swiperTop: frameH * GRID_TOP_PCT,
      swiperW: cell * 3 + gap * 2,
      swiperH: cell * 5 + gap * 4,
    });
    resolveAssetMap(DIARY_ASSETS).then((assets) => {
      this.setData({ assets });
    });
  },

  onShow() {
    this.reload();
  },

  async reload() {
    const allEntries = sortByClaimTime(await listDiary());
    const present = new Set(allEntries.map((e) => e.type));
    const tabs = POSTCARD_TYPE_ORDER.filter((t) => present.has(t)).map((type) => ({
      type,
      label: POSTCARD_TYPE_LABELS[type],
    }));
    // 一个条目都没有时也保留一个 tab（默认明信片），笔记本始终有可点标签
    if (!tabs.length) {
      tabs.push({ type: POSTCARD_TYPE_ORDER[0], label: POSTCARD_TYPE_LABELS[POSTCARD_TYPE_ORDER[0]] });
    }
    // 保持原选中项；失效（该类型已不存在）时回退到第一个 tab
    const activeTab = tabs.some((t) => t.type === this.data.activeTab)
      ? this.data.activeTab
      : tabs.length
        ? tabs[0].type
        : '';
    this.setData({ allEntries, tabs, activeTab });
    this.applyTab();
  },

  /** 按当前 tab 过滤条目并铺网格；只渲染实际存在的明信片格子 */
  applyTab() {
    const entries = this.data.allEntries.filter((e: DiaryEntry) => e.type === this.data.activeTab);
    const gridSlots = entries.map((entry, i) => ({
      key: entry.postcardId,
      entryIndex: i,
      imageThumb: entry.imageThumb,
      imageFull: entry.imageFull,
    }));
    // 按每页 PAGE_SIZE 个切分，供 swiper 左右翻页
    const pages = chunk(gridSlots, PAGE_SIZE);
    // 首次有翻页需求（超过一页）且未展示过提示时显示
    const showHint = gridSlots.length > PAGE_SIZE && !wx.getStorageSync(HINT_STORAGE_KEY);
    this.setData({
      entries,
      gridSlots,
      pages,
      currentPage: 0,
      showHint,
      empty: this.data.allEntries.length === 0,
    });
  },

  onTapTab(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as PostcardType;
    if (!type || type === this.data.activeTab) return;
    playSfx('diary_flip');
    this.setData({ activeTab: type });
    this.applyTab();
  },

  onTapBack() {
    playTap();
    navigateBack('/pages/home/index');
  },

  /** swiper 左右翻页时同步当前页码 */
  onSwiperChange(e: WechatMiniprogram.SwiperChange) {
    playSfx('diary_flip');
    this.setData({ currentPage: e.detail.current });
  },

  /** 点击任意位置关闭翻页提示，并写入存储，之后不再展示 */
  onDismissHint() {
    wx.setStorageSync(HINT_STORAGE_KEY, true);
    this.setData({ showHint: false });
  },

  onTapEntry(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    if (index < 0) return;
    const entry = this.data.entries[index];
    if (!entry) return;
    playTap();
    this.setData({
      zoomVisible: true,
      letterVisible: false,
      zoomImage: entry.imageFull || '',
      zoomTitle: entry.title,
      letterDate: formatDiaryDate(entry.firstClaimedAt),
      letterStory: entry.story || '',
    });
  },

  onCloseZoom() {
    this.setData({
      zoomVisible: false,
      letterVisible: false,
      zoomImage: '',
      zoomTitle: '',
      letterDate: '',
      letterStory: '',
    });
  },

  onTapEnvelope() {
    playTap();
    this.setData({ letterVisible: true });
  },

  onCloseLetter() {
    this.setData({ letterVisible: false });
  },
});
