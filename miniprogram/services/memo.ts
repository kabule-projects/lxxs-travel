import { call } from './api';

export interface MemoItem {
  id: string;
  dateKey: string;
  content: string;
  editCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoListResult {
  items: MemoItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 历史列表：dateKey 倒序，同天内 createdAt 倒序（一天可多条） */
export async function listMemos(page = 1, pageSize = 20): Promise<MemoListResult> {
  return call<MemoListResult>('memo', { action: 'list', page, pageSize });
}

/** 取一条备忘录（编辑用，按 id） */
export async function getMemo(id: string): Promise<{
  memo: MemoItem;
  rewardHint: { stars: number; riceStarRate: number };
}> {
  return call('memo', { action: 'get', id });
}

/**
 * 保存：传 id = 编辑既有记录（不限次数，不发奖）；
 * 不传 id = 新建记录（当天第一次新建领每日奖励，一天一次）。
 */
export async function saveMemo(
  content: string,
  id?: string,
): Promise<{
  created: boolean;
  memo: MemoItem;
  reward: { stars: number; rice: number; grantedNow: boolean };
}> {
  return call('memo', { action: 'save', content, id });
}
