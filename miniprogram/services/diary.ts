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

/** 配置标题里的字面量 "\n"（json 转义残留）换成真实换行，避免直接显示反斜杠 n */
export function normalizeTitle(t: string): string {
  return (t || '').replace(/\\n/g, '\n');
}

async function hydrateDiary(items: DiaryEntry[]): Promise<DiaryEntry[]> {
  if (!items.length) return [];
  // resolveDynamicAssetList 的 T extends Record<string, unknown> 不吃 interface 索引签名，需断言
  return (await resolveDynamicAssetList(items, ['imageThumb', 'imageFull'])) as DiaryEntry[];
}

/** 日记图鉴：云端 user_postcards → 解析图片路径；云端连不上直接抛错 */
export async function listDiary(): Promise<DiaryEntry[]> {
  const res = await call<{ items: DiaryEntry[] }>('postcard', {
    action: 'diary',
  });
  const items = await hydrateDiary(res.items || []);
  return items.map((e) => ({ ...e, title: normalizeTitle(e.title) }));
}
