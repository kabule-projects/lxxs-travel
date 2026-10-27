import { call } from './api';
import { getStars, setStars, getRiceStars, setRiceStars } from '../store/user';
import { readInventoryCounts, writeInventoryCounts, clearInvCache } from './inventory';

export interface RedeemItem {
  itemId: string;
  name: string;
  icon: string;
  count: number;
}

/** 明信片奖励（云端写入日记图鉴，不入背包） */
export interface RedeemPostcard {
  postcardId: string;
  title: string;
  rarity: string;
  imageThumb: string;
  /** true=本次新入图鉴；false=图鉴已有（重复获得） */
  firstUnlock: boolean;
}

export interface RedeemResult {
  code: string;
  stars: number;
  riceStars: number;
  items: RedeemItem[];
  postcards?: RedeemPostcard[];
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
  clearInvCache();
  return res;
}

/** 兑换结果转展示文案（系统弹窗 content） */
export function describeRedeem(res: RedeemResult): string {
  const parts: string[] = [];
  // 明信片最醒目（稀有奖励）；图鉴已有的标注一下，避免玩家误以为新获得
  for (const pc of res.postcards || []) {
    parts.push(pc.firstUnlock === false ? `${pc.title}（图鉴已有）` : pc.title);
  }
  for (const it of res.items || []) parts.push(`${it.name}×${it.count}`);
  if (res.stars) parts.push(`星星×${res.stars}`);
  if (res.riceStars) parts.push(`米子星×${res.riceStars}`);
  return parts.length ? `获得 ${parts.join('、')}` : '已兑换成功';
}
