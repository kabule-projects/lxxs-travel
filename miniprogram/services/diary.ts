import { call } from './api';
import { resolveDynamicAssetList } from '../utils/resolve-dynamic-asset';

export type PostcardType = 'postcard' | 'letter' | 'photo' | 'special';

export interface DiaryEntry {
  postcardId: string;
  type: PostcardType;
  title: string;
  rarity: string;
  imageThumb: string;
  imageFull: string;
  story: string;
  firstClaimedAt: number;
  claimCount: number;
}

const DIARY_KEY = 'lxxs_diary_local';

function readLocalDiary(): DiaryEntry[] {
  try {
    const raw = wx.getStorageSync(DIARY_KEY) as DiaryEntry[] | '';
    if (Array.isArray(raw)) return raw;
  } catch {
    /* ignore */
  }
  return [];
}

function writeLocalDiary(entries: DiaryEntry[]) {
  try {
    wx.setStorageSync(DIARY_KEY, entries);
  } catch {
    /* ignore */
  }
}

async function hydrateDiary(items: DiaryEntry[]): Promise<DiaryEntry[]> {
  if (!items.length) return [];
  return resolveDynamicAssetList(items, ['imageThumb', 'imageFull']);
}

/** 日记图鉴：云端 user_postcards → 解析图片路径；失败读本地缓存 */
export async function listDiary(): Promise<DiaryEntry[]> {
  try {
    const res = await call<{ items: DiaryEntry[] }>('postcard', {
      action: 'diary',
    });
    const items = await hydrateDiary(res.items || []);
    writeLocalDiary(items);
    return items;
  } catch {
    return readLocalDiary();
  }
}

/** 收下明信片后合并进本地日记缓存（云端 claim 成功后调用） */
export function cacheDiaryEntry(entry: Partial<DiaryEntry> & { postcardId: string }) {
  const list = readLocalDiary();
  const idx = list.findIndex((e) => e.postcardId === entry.postcardId);
  const now = Date.now();
  if (idx < 0) {
    list.push({
      postcardId: entry.postcardId,
      type: entry.type || 'postcard',
      title: entry.title || '明信片',
      rarity: entry.rarity || 'N',
      imageThumb: entry.imageThumb || entry.imageFull || '',
      imageFull: entry.imageFull || entry.imageThumb || '',
      story: entry.story || '',
      firstClaimedAt: now,
      claimCount: 1,
    });
  } else {
    list[idx] = {
      ...list[idx],
      ...entry,
      imageThumb: entry.imageThumb ?? list[idx].imageThumb,
      imageFull: entry.imageFull ?? list[idx].imageFull,
      claimCount: (list[idx].claimCount || 1) + 1,
    };
  }
  writeLocalDiary(list);
}
