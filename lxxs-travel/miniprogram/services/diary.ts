import { call } from './api';

export interface DiaryEntry {
  postcardId: string;
  title: string;
  rarity: string;
  imageThumb: string;
  imageFull: string;
  story: string;
  firstClaimedAt: number;
  claimCount: number;
}

export async function listDiary(): Promise<DiaryEntry[]> {
  try {
    const res = await call<{ items: DiaryEntry[] }>('postcard', {
      action: 'diary',
    });
    return res.items || [];
  } catch {
    return [];
  }
}
