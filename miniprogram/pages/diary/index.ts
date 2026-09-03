import { DIARY_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readSafeArea } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { listDiary, type DiaryEntry } from '../../services/diary';

type PageAssets = Record<keyof typeof DIARY_ASSETS, string>;

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
    safeTop: 0,
    assets: {} as PageAssets,
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
    showSettings: false,
  },

  onLoad() {
    const { top } = readSafeArea();
    this.setData({ safeTop: top });
    resolveAssetMap(DIARY_ASSETS).then((assets) => {
      this.setData({ assets });
    });
  },

  onShow() {
    this.reload();
  },

  async reload() {
    const entries = sortByClaimTime(await listDiary());
    /** 设计稿一屏约 3×5；不足时用空半透明格补齐 */
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
    this.setData({ entries, gridSlots, empty: entries.length === 0 });
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
