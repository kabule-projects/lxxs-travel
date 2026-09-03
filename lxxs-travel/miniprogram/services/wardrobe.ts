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
  try {
    return await call<WardrobeListResult>('wardrobe', { action: 'list' });
  } catch {
    return {
      empty: true,
      message: '衣柜还是空的，扭蛋服装将在后续版本出现',
      items: [],
    };
  }
}
