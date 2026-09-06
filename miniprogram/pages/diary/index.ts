import { DIARY_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readCapsuleRect } from '../../utils/device';
import { playTap } from '../../services/sound';
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

Page({
  data: {
    /** 顶栏 top（frame 坐标系）：胶囊底边 + 间距，frame 居中溢出时补偿偏移 */
    hudTop: 0,
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
    empty: true,
    zoomVisible: false,
    letterVisible: false,
    zoomImage: '',
    zoomTitle: '',
    letterDate: '',
    letterStory: '',
  },

  onLoad() {
    // frame 宽撑满屏幕、垂直居中；hudTop 换算到 frame 坐标系（frame 高于屏幕被裁切时补偿居中偏移）
    const capsule = readCapsuleRect();
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.screenWidth || info.windowWidth || 375;
    const screenH = info.screenHeight || info.windowHeight || 812;
    const frameH = (screenW * 4330) / 2002;
    const frameOffsetY = (screenH - frameH) / 2;
    // 返回键与胶囊垂直居中对齐：nav-icon sm 高 96rpx
    const btnH = (screenW * 96) / 750;
    this.setData({ hudTop: capsule.top + (capsule.height - btnH) / 2 - frameOffsetY });
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

  /** 按当前 tab 过滤条目并铺网格；不足时用空半透明格补齐 */
  applyTab() {
    const entries = this.data.allEntries.filter((e: DiaryEntry) => e.type === this.data.activeTab);
    /** 设计稿一屏约 3×5；不足时补空位 */
    const minSlots = 15;
    const slotCount = Math.max(minSlots, Math.ceil(entries.length / 3) * 3);
    const gridSlots = Array.from({ length: slotCount }, (_, i) => {
      const entry = entries[i];
      if (!entry) {
        return { key: `empty-${i}`, entryIndex: -1 };
      }
      return {
        key: entry.postcardId,
        entryIndex: i,
        imageThumb: entry.imageThumb,
        imageFull: entry.imageFull,
      };
    });
    this.setData({ entries, gridSlots, empty: this.data.allEntries.length === 0 });
  },

  onTapTab(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as PostcardType;
    if (!type || type === this.data.activeTab) return;
    playTap();
    this.setData({ activeTab: type });
    this.applyTab();
  },

  onTapBack() {
    playTap();
    navigateBack('/pages/home/index');
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

  onStopZoom() {},

  onTapEnvelope() {
    playTap();
    this.setData({ letterVisible: true });
  },

  onCloseLetter() {
    this.setData({ letterVisible: false });
  },
});
