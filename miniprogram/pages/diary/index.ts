import { DIARY_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { playSfx, playTap } from '../../services/sound';
import { navigateBack, navigateTo } from '../../utils/nav';
import { listDiary, type DiaryEntry, type PostcardType } from '../../services/diary';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  notifyGuideBlocked,
  setGuideBackGuard,
} from '../../utils/guide-page';
import type { GuideHole } from '../../components/guide-overlay/guide-overlay';

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
/** 上边距（相对 frame 高）。注意：要整体上移网格就改这里，
 *  不要给 swiper-item 加负 top——原生 swiper 会裁掉移出自身矩形的部分，第一行会被切掉 */
const GRID_TOP_PCT = 0.2567;  // = 原 0.29 再上移 54rpx（54 / 帧高 1622rpx）
/** 单个格子边长占屏幕宽度的比例；改这个直接放大/缩小所有格子 */
const GRID_CELL_PCT = 0.19;
/** 格子间距（rpx，与 wxss 的 gap 保持一致） */
const GRID_GAP_RPX = 48;

/** 备忘录入口按钮：贴内页天气图标行右侧，尺寸与图标一致
 *  （按新 diary-bg 原图 1321×2869 实测：图标约 130×130px，雨图标右缘 x≈0.446，行顶 y≈0.132） */
const MEMO_BTN_LEFT_PCT = 0.465; // 相对 frame 宽
const MEMO_BTN_TOP_PCT = 0.132;  // 相对 frame 高
const MEMO_BTN_W_PCT = 0.098;    // 相对 frame 宽（= 天气图标边长占比）

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
    /** 备忘录入口按钮像素位置/尺寸（与天气图标同大，按 frame 百分比换算） */
    memoBtnLeft: 0,
    memoBtnTop: 0,
    memoBtnW: 0,
    memoBtnH: 0,
    /** 是否展示翻页提示贴图（首次收集超过一页时显示，点击关闭后不再出现） */
    showHint: false,
    empty: true,
    zoomVisible: false,
    letterVisible: false,
    zoomImage: '',
    zoomTitle: '',
    letterDate: '',
    letterStory: '',
    /** 新手指引遮罩 */
    guideVisible: false,
    guideHoles: [] as GuideHole[],
    guideHit: null as { x: number; y: number; w: number; h: number } | null,
    guideText: '',
    /** 弹窗显示期间遮罩进入无遮罩模式（只显示文字泡，不渲染黑色遮罩） */
    guideNoMask: false,
    /** diary-envelope 步骤的独立气泡文字（弹窗内显示，guide-overlay 不渲染） */
    guideBubbleVisible: false,
    guideBubbleText: '',
    /** 气泡内联定位（大图下方、指向右下角信封） */
    guideBubbleStyle: '',
  },

  /** 新手指引状态 */
  _guideStep: '' as string,
  _guideTimer: 0 as number,
  _guideBlockedAt: 0 as number,
  _offGuide: null as (() => void) | null,
  /** 明信片大图 / 信件是否正在展示（未完全关闭前不渲染指引遮罩，避免挡住"点空白关闭"） */
  _zoomOpen: false as boolean,
  _letterOpen: false as boolean,
  /** 是否已进入过备忘录（从 memo 返回时据此推进到 diary-back） */
  _memoVisited: false as boolean,

  onLoad() {
    // swiper 是原生组件，必须内联明确的 px 尺寸/位置。
    // 3×4 正方形格子 → swiper 宽 = 3×格子+2×间距，高 = 4×格子+3×间距，宽高比由格子锁定
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.screenWidth || info.windowWidth || 375;
    const frameH = (screenW * 4330) / 2002;
    const cell = screenW * GRID_CELL_PCT;
    const gap = (screenW * GRID_GAP_RPX) / 750;
    const memoBtnW = screenW * MEMO_BTN_W_PCT;
    this.setData({
      swiperLeft: screenW * GRID_LEFT_PCT,
      swiperTop: frameH * GRID_TOP_PCT,
      swiperW: cell * 3 + gap * 2,
      swiperH: cell * 5 + gap * 4,
      memoBtnLeft: screenW * MEMO_BTN_LEFT_PCT,
      memoBtnTop: frameH * MEMO_BTN_TOP_PCT,
      memoBtnW,
      memoBtnH: memoBtnW,
    });
    resolveAssetMap(DIARY_ASSETS).then((assets) => {
      this.setData({ assets });
    });
    this._offGuide = guide.onChange(() => {
      this.refreshGuide();
    });
  },

  onShow() {
    // 教程推进：从 home 进入 diary → 推进到 diary-postcard
    if (guide.isStep('home-diary')) {
      guide.advance('diary-postcard');
    }
    // 教程推进：从备忘录返回 → 推进到 diary-back（引导点击左下角返回小屋）
    if (this._memoVisited && guide.isStep('diary-memo')) {
      this._memoVisited = false;
      guide.advance('diary-back');
    }
    this.reload();
    this.refreshGuide();
    // 仅 diary-postcard 步需要防误退出；点开明信片（进入 envelope）后即取消拦截
    setGuideBackGuard(guide.isStep('diary-postcard'));
  },

  async reload() {
    let allEntries;
    try {
      allEntries = sortByClaimTime(await listDiary());
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '日记加载失败',
        icon: 'none',
      });
      return;
    }
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
    // 空 diary 时 diary-postcard 无可点击目标，直接跳过到 memo 步骤
    if (guide.isStep('diary-postcard') && entries.length === 0) {
      guide.advance('diary-memo');
    }
  },

  onTapTab(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as PostcardType;
    if (!type || type === this.data.activeTab) return;
    playSfx('diary_flip');
    this.setData({ activeTab: type });
    this.applyTab();
  },

  onTapBack() {
    if (guide.isActive() && !guide.isStep('diary-back')) return;
    playTap();
    navigateBack('/pages/home/index');
  },

  /** 备忘录入口：进入旅行记录列表页（编辑器 UI 接入后行点击再跳编辑） */
  onTapMemo() {
    if (guide.isActive() && !guide.isStep('diary-memo')) return;
    playTap();
    if (guide.isStep('diary-memo')) this._memoVisited = true;
    navigateTo('/pages/memo/index');
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
    if (guide.isActive() && !guide.isStep('diary-postcard')) return;
    const index = Number(e.currentTarget.dataset.index);
    if (index < 0) return;
    const entry = this.data.entries[index];
    if (!entry) return;
    playTap();
    this._zoomOpen = true;
    this._letterOpen = false;
    this.setData({
      zoomVisible: true,
      letterVisible: false,
      zoomImage: entry.imageFull || '',
      zoomTitle: entry.title,
      letterDate: formatDiaryDate(entry.firstClaimedAt),
      letterStory: entry.story || '',
      guideNoMask: true, // 弹窗期间遮罩进入无遮罩模式（只显示文字泡）
      guideBubbleStyle: this.calcEnvelopeBubbleStyle(),
    });
    // diary-postcard 步骤：点击明信片打开大图后，推进到 diary-envelope（等用户点信封）
    if (guide.isStep('diary-postcard')) {
      guide.advance('diary-envelope');
      this.refreshGuide(); // 直接刷新，确保 postcard 气泡消失、envelope 气泡出现
    }
  },

  /** 计算 envelope 指引气泡位置：大图卡片下方、右端对齐信封列（卡片 75vw、3:4、全屏居中） */
  calcEnvelopeBubbleStyle(): string {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.windowWidth || 375;
    const screenH = info.windowHeight || 667;
    const cardW = screenW * 0.75;
    const cardH = (cardW * 4) / 3;
    const cardTop = (screenH - cardH) / 2;
    const cardRight = (screenW + cardW) / 2;
    const bubbleW = (screenW * 440) / 750; // 与 wxss .diary-guide-bubble-text 宽度一致
    const left = cardRight - bubbleW - (screenW * 16) / 750;
    const top = cardTop + cardH + (screenW * 20) / 750;
    return `left:${left}px;top:${top}px;`;
  },

  onCloseZoom() {
    this._zoomOpen = false;
    this._letterOpen = false;
    this.setData({
      zoomVisible: false,
      letterVisible: false,
      zoomImage: '',
      zoomTitle: '',
      letterDate: '',
      letterStory: '',
      guideNoMask: false,
      guideBubbleVisible: false,
      guideBubbleText: '',
      guideBubbleStyle: '',
    });
    // 大图完全关闭后 memo 阶段才开始：
    // - 没点信封就关大图：补推进到 diary-memo
    // - 已点信封（步骤已是 diary-memo）：直接刷新出指向备忘录按钮的遮罩
    if (guide.isStep('diary-envelope')) {
      guide.advance('diary-memo');
    }
    if (guide.isStep('diary-memo')) {
      this.refreshGuide();
    }
  },

  onTapEnvelope() {
    if (guide.isActive() && !guide.isStep('diary-envelope')) return;
    playTap();
    this._letterOpen = true;
    this.setData({ letterVisible: true });
    // diary-envelope 步骤：点信封打开信件后推进到 diary-memo，
    // 但遮罩要等"关信件 + 关大图"两次空白点击后才渲染（refreshGuide 内按弹层状态压制）
    if (guide.isStep('diary-envelope')) {
      guide.advance('diary-memo');
    }
    this.setData({ guideBubbleVisible: false, guideBubbleText: '' });
  },

  onCloseLetter() {
    // 只关信件，大图仍在显示：用户还需再点一次空白关闭大图，期间不渲染指引遮罩
    this._letterOpen = false;
    this.setData({ letterVisible: false, guideBubbleVisible: false, guideBubbleText: '' });
  },

  onUnload() {
    this._offGuide?.();
    if (this._guideTimer) clearTimeout(this._guideTimer);
    setGuideBackGuard(false);
  },

  /** 新手指引：按当前步骤刷新遮罩与开孔（diary 宿主） */
  refreshGuide() {
    if (guide.isStep('diary-envelope')) {
      // 弹窗打开期间 diary-envelope 步骤：不渲染 guide-overlay（用户可自由点击），
      // 通过独立气泡文字提示用户点击信封（气泡定位在大图下方、指向右下角信封）
      // postcard 已完成：直接取消返回拦截，后续 envelope/memo/back 均不再拦截
      setGuideBackGuard(false);
      const meta = guide.getMeta();
      if (meta) {
        this._guideStep = meta.step;
        this.setData({
          guideVisible: false,
          guideBubbleVisible: true,
          guideBubbleText: meta.text,
        });
      }
      return;
    }
    // 大图/信件尚未完全关闭时（点开 envelope 后需点空白两次）不渲染遮罩：
    // guide-overlay 层级高于弹层，提前渲染会挡住"点空白关闭"操作导致软锁
    if (this._zoomOpen || this._letterOpen) {
      this.setData({ guideVisible: false, guideBubbleVisible: false, guideBubbleText: '' });
      return;
    }
    // 其他步骤：正常渲染 guide-overlay，隐藏独立气泡
    this.setData({ guideBubbleVisible: false, guideBubbleText: '' });
    refreshGuideHost('diary', this);
    // 仅 diary-postcard 步拦截返回；postcard 完成后（envelope/memo/back）一律放行
    setGuideBackGuard(guide.isStep('diary-postcard'));
  },

  /** 遮罩暗区被点击：节流提示 */
  onGuideBlocked() {
    notifyGuideBlocked(this);
  },
});
