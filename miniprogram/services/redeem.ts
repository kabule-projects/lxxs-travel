import { call } from './api';
import { getStars, setStars, getRiceStars, setRiceStars } from '../store/user';
import { readInventoryCounts, writeInventoryCounts } from './inventory';

export interface RedeemItem {
  itemId: string;
  name: string;
  icon: string;
  count: number;
}

export interface RedeemResult {
  code: string;
  stars: number;
  riceStars: number;
  items: RedeemItem[];
}

/** 兑换码兑换；错误 code：NOT_FOUND_CODE 不存在 / ALREADY_USED 已兑换 / EXPIRED 过期 / EXHAUSTED 兑完 */
export async function redeemCode(code: string): Promise<RedeemResult> {
  const res = await call<RedeemResult>('redeem', { action: 'exchange', code });
  // 同步本地货币与背包计数，UI 立即反映
  if (res.stars) setStars(getStars() + res.stars);
  if (res.riceStars) setRiceStars(getRiceStars() + res.riceStars);
  if (Array.isArray(res.items) && res.items.length) {
    const map = readInventoryCounts();
    for (const it of res.items) {
      // 云端返回的是该物品入库后的总数，直接覆盖本地计数
      map[it.itemId] = it.count;
    }
    writeInventoryCounts(map);
  }
  return res;
}

/** 兑换结果转展示文案（系统弹窗 content） */
export function describeRedeem(res: RedeemResult): string {
  const parts: string[] = [];
  for (const it of res.items || []) parts.push(`${it.name}×${it.count}`);
  if (res.stars) parts.push(`星星×${res.stars}`);
  if (res.riceStars) parts.push(`米子星×${res.riceStars}`);
  return parts.length ? `获得 ${parts.join('、')}` : '已兑换成功';
}
