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
    this.setData({ entries, empty: entries.length === 0 });
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
    const entry = this.data.entries[index];
    if (!entry) return;
    playTap();
    this.setData({
      zoomVisible: true,
      letterVisible: false,
      zoomImage: entry.imageFull || entry.imageThumb || '',
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
