import { call } from './api';

export interface WardrobeListResult {
  empty: boolean;
  message: string;
  items: Array<{
    outfitId: string;
    name: string;
    icon: string;
    equipped: boolean;
    obtainedAt: number;
  }>;
}

export async function listWardrobe(): Promise<WardrobeListResult> {
  // 云端连不上直接抛错，由页面提示用户
  return call<WardrobeListResult>('wardrobe', { action: 'list' });
}
