import { call } from './api';

export interface MemoItem {
  dateKey: string;
  content: string;
  editCount: number;
  starsGranted: number;
  riceGranted: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoListResult {
  items: MemoItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 历史列表：dateKey 倒序分页 */
export async function listMemos(page = 1, pageSize = 20): Promise<MemoListResult> {
  return call<MemoListResult>('memo', { action: 'list', page, pageSize });
}

/** 取某天备忘录（默认今天）；memo 为 null 表示当天还没记录 */
export async function getMemo(dateKey?: string): Promise<{
  dateKey: string;
  memo: MemoItem | null;
  rewardHint: { stars: number; riceStarRate: number };
}> {
  return call('memo', { action: 'get', dateKey });
}

/** 首次记录或编辑（编辑不限次数，不重复发奖） */
export async function saveMemo(
  content: string,
  dateKey?: string,
): Promise<{
  created: boolean;
  memo: MemoItem;
  reward: { stars: number; rice: number; grantedNow: boolean };
}> {
  return call('memo', { action: 'save', content, dateKey });
}
