import { completeGuideApi, type GuideCompleteResult, type UserProfile } from './api';
import { emit, on, GameEvent } from '../utils/event-bus';
import { resolveAsset } from '../utils/resolve-assets';
import { resolveDynamicAsset } from '../utils/resolve-dynamic-asset';
import { setStars, setRiceStars } from '../store/user';
import type { GachaResultItem } from '../components/gacha-result/gacha-result';

/** 本地完成标志（云端 guideCompletedAt 兜底）；冷启动判定以此为准 */
export const GUIDE_COMPLETED_KEY = 'lxxs_guide_completed';

/** 冷启动重开时需要清零的本地经济缓存（云端由 roof sync 重置；pool 是静态奖池不清） */
const LOCAL_ECONOMY_KEYS = [
  'lxxs_roof_local',
  'lxxs_shop_local',
  'lxxs_inventory_local',
  'lxxs_gacha_owned',
  'lxxs_gacha_pity',
];

/** 指引步骤（固定顺序，18 步） */
export type GuideStep =
  | 'roof-stars'
  | 'roof-to-shop'
  | 'shop-select'
  | 'shop-buy'
  | 'shop-to-gacha'
  | 'gacha-draw'
  | 'gacha-result'
  | 'home-bag'
  | 'bag-food'
  | 'picker-food'
  | 'bag-prop'
  | 'picker-prop'
  | 'bag-depart'
  | 'home-showcase'
  | 'home-diary'
  | 'diary-postcard'
  | 'diary-envelope'
  | 'diary-memo'
  | 'diary-back'
  | 'home-window';

/** 步骤所属宿主：页面或自定义组件（组件隔离下遮罩需组件内部渲染） */
export type GuideHost =
  | 'roof'
  | 'shop'
  | 'gacha'
  | 'home'
  | 'bag-modal'
  | 'inventory-picker'
  | 'gacha-result'
  | 'diary';

/** 放行矩形策略：bbox=开孔外接矩形；roof-band=屋顶星星活动带（页面计算） */
export type GuideHitStrategy = 'bbox' | 'roof-band';

export interface GuideStepMeta {
  step: GuideStep;
  host: GuideHost;
  /** 宿主内待测量目标选择器（roof-stars 为多孔） */
  selectors: string[];
  hit: GuideHitStrategy;
  text: string;
}

export const GUIDE_ORDER: GuideStep[] = [
  'roof-stars',
  'roof-to-shop',
  'shop-select',
  'shop-buy',
  'shop-to-gacha',
  'gacha-draw',
  'gacha-result',
  'home-bag',
  'bag-food',
  'picker-food',
  'bag-prop',
  'picker-prop',
  'bag-depart',
  'home-showcase',
  'home-diary',
  'diary-postcard',
  'diary-envelope',
  'diary-memo',
  'diary-back',
  'home-window',
];

export const GUIDE_META: Record<GuideStep, GuideStepMeta> = {
  'roof-stars': {
    step: 'roof-stars',
    host: 'roof',
    selectors: ['.guide-star--dropped'],
    hit: 'roof-band',
    text: '欢迎来到《旅行小深》！\n点击拾起星星',
  },
  'roof-to-shop': {
    step: 'roof-to-shop',
    host: 'roof',
    selectors: ['.guide-anchor-shop'],
    hit: 'bbox',
    text: '做得好！点击商店按钮去逛逛吧。',
  },
  'shop-select': {
    step: 'shop-select',
    host: 'shop',
    selectors: ['.guide-anchor-cell'],
    hit: 'bbox',
    text: '是完美食物土豆！点击选中它。',
  },
  'shop-buy': {
    step: 'shop-buy',
    host: 'shop',
    selectors: ['.guide-anchor-buy'],
    hit: 'bbox',
    text: '点击购买按钮，花 3 颗星星拿下它。',
  },
  'shop-to-gacha': {
    step: 'shop-to-gacha',
    host: 'shop',
    selectors: ['.guide-anchor-gacha'],
    hit: 'bbox',
    text: '买好啦，点击前往扭蛋机吧！',
  },
  'gacha-draw': {
    step: 'gacha-draw',
    host: 'gacha',
    selectors: ['.guide-anchor-draw1'],
    hit: 'bbox',
    text: '点击「抽一次」，花费 5 颗星星抽取道具。',
  },
  'gacha-result': {
    step: 'gacha-result',
    host: 'gacha-result',
    selectors: ['.guide-anchor-confirm'],
    hit: 'bbox',
    text: '这是你抽到的道具，点击确认收下。',
  },
  'home-bag': {
    step: 'home-bag',
    host: 'home',
    selectors: ['.guide-anchor-bag'],
    hit: 'bbox',
    text: '欢迎回到小屋！点击下方「准备」按钮打开背包。',
  },
  'bag-food': {
    step: 'bag-food',
    host: 'bag-modal',
    selectors: ['.slot-food'],
    hit: 'bbox',
    text: '先点击便当盒，把食物放进去。',
  },
  'picker-food': {
    step: 'picker-food',
    host: 'inventory-picker',
    selectors: ['.guide-anchor-pick0'],
    hit: 'bbox',
    text: '选择完美的土豆作为旅途食物。',
  },
  'bag-prop': {
    step: 'bag-prop',
    host: 'bag-modal',
    selectors: ['.slot-prop0'],
    hit: 'bbox',
    text: '带上道具可以去到特别的旅游地点哦。',
  },
  'picker-prop': {
    step: 'picker-prop',
    host: 'inventory-picker',
    selectors: ['.guide-anchor-pick0'],
    hit: 'bbox',
    text: '选择刚抽到的道具。',
  },
  'bag-depart': {
    step: 'bag-depart',
    host: 'bag-modal',
    selectors: ['.depart-btn-img'],
    hit: 'bbox',
    text: '行李准备好啦，让小深出发去旅行吧！',
  },
  'home-showcase': {
    step: 'home-showcase',
    host: 'home',
    selectors: ['.guide-anchor-showcase'],
    hit: 'bbox',
    text: '小深带回来的纪念品会陈列在这里。',
  },
  'home-diary': {
    step: 'home-diary',
    host: 'home',
    selectors: ['.guide-anchor-diary'],
    hit: 'bbox',
    text: '旅行中的故事会记录在日记里，点开看看吧。',
  },
  'diary-postcard': {
    step: 'diary-postcard',
    host: 'diary',
    selectors: ['.guide-anchor-postcard'],
    hit: 'bbox',
    text: '这是小深寄来的明信片。',
  },
  'diary-envelope': {
    step: 'diary-envelope',
    host: 'diary',
    selectors: ['.guide-anchor-unreachable'],
    hit: 'bbox',
    // 信封在 postcard-zoom 组件内部，组件隔离导致选择器不可达；
    // 用空选择器使 measureGuideHost 找不到目标 → 不渲染遮罩开孔，
    // 仅显示气泡文字（引导弹窗内操作），弹窗关闭后才恢复遮罩
    text: '点击信封看看小深写了什么。',
  },
  'diary-memo': {
    step: 'diary-memo',
    host: 'diary',
    selectors: ['.guide-anchor-memo'],
    hit: 'bbox',
    text: '这里可以写自己的旅行日记。',
  },
  'diary-back': {
    step: 'diary-back',
    host: 'diary',
    selectors: ['.guide-anchor-diary-back'],
    hit: 'bbox',
    text: '点击返回小屋。',
  },
  'home-window': {
    step: 'home-window',
    host: 'home',
    selectors: ['.guide-anchor-window'],
    hit: 'bbox',
    text: '点击窗户回到屋顶（翻窗危险，请勿模仿）',
  },
};

interface GuideState {
  active: boolean;
  completed: boolean;
  step: GuideStep | null;
}

const state: GuideState = {
  active: false,
  completed: false,
  step: null,
};

function emitChanged(): void {
  emit(GameEvent.GUIDE_CHANGED, { active: state.active, step: state.step });
}

export function isCompletedLocally(): boolean {
  try {
    return !!wx.getStorageSync(GUIDE_COMPLETED_KEY);
  } catch {
    return false;
  }
}

/**
 * 用登录会话初始化完成状态。
 * 云端 profile 可用时以云端为准（null=未完成 → 激活指引）；
 * 仅当 profile 缺失（离线/未登录）时用本地标志兜底。
 * @returns 是否需要激活指引（未完成）；已完成返回 false
 */
export function initFromProfile(profile?: UserProfile | null): boolean {
  // 本会话已由 complete() 标记完成：不再重新评估，避免缓存 profile 尚未刷新导致误激活
  if (state.completed) return false;
  // 云端 profile 可用：以云端为准
  if (profile) {
    if (profile.guideCompletedAt) {
      state.completed = true;
      state.active = false;
      state.step = null;
      try {
        wx.setStorageSync(GUIDE_COMPLETED_KEY, profile.guideCompletedAt);
      } catch {
        /* ignore */
      }
      return false;
    }
    // 云端明确说未完成（guideCompletedAt 为 null）：
    // 清除可能陈旧的本地完成标志，确保指引能正常激活
    try {
      wx.setStorageSync(GUIDE_COMPLETED_KEY, '');
    } catch {
      /* ignore */
    }
    state.completed = false;
    return true;
  }
  // profile 缺失（离线/未登录）：用本地标志兜底
  if (isCompletedLocally()) {
    state.completed = true;
    state.active = false;
    state.step = null;
    return false;
  }
  return true;
}

/** 冷启动激活：清零本地教学经济缓存，固定从首步开始。
 *  @returns 本次是否真正激活（false=已完成/已在进行中，未发生变化） */
export function start(): boolean {
  if (state.completed || state.active) return false;
  try {
    LOCAL_ECONOMY_KEYS.forEach((key) => wx.setStorageSync(key, ''));
  } catch {
    /* ignore */
  }
  state.active = true;
  state.step = GUIDE_ORDER[0];
  emitChanged();
  return true;
}

export function isActive(): boolean {
  return state.active;
}

export function getStep(): GuideStep | null {
  return state.active ? state.step : null;
}

export function isStep(...steps: GuideStep[]): boolean {
  return state.active && !!state.step && steps.includes(state.step);
}

/** 当前步骤是否属于指定宿主（页面/组件据此决定是否渲染遮罩） */
export function isHost(host: GuideHost): boolean {
  return state.active && !!state.step && GUIDE_META[state.step].host === host;
}

export function getMeta(step: GuideStep | null = state.step): GuideStepMeta | null {
  return step ? GUIDE_META[step] : null;
}

/** 推进到指定步骤。
 *  默认按 GUIDE_ORDER 前进一步；传 step 时直接跳到该步（用于预奖励弹窗后跨步）。 */
export function advance(target?: GuideStep): void {
  if (!state.active || !state.step) return;
  const next = target || GUIDE_ORDER[Math.min(GUIDE_ORDER.indexOf(state.step) + 1, GUIDE_ORDER.length - 1)];
  if (next === state.step) return;
  state.step = next;
  emitChanged();
}

/** 指引完成（真实出发成功）：本地立即生效，云端回写失败不阻断。
 *  @returns 云端结果（含首次完成的新手奖励）；离线/失败返回 null，下次启动由云端幂等兜底 */
export async function complete(): Promise<GuideCompleteResult | null> {
  if (state.completed) return null;
  state.completed = true;
  state.active = false;
  state.step = null;
  try {
    wx.setStorageSync(GUIDE_COMPLETED_KEY, Date.now());
  } catch {
    /* ignore */
  }
  emitChanged();
  // 无论是否已提前发奖，都要调一次云端（markCompleted=true）：
  // preReward 只发奖不写 guideCompletedAt，这里负责真正标记完成。
  // 云端发奖闸（guideRewardedAt 原子认领）保证奖励不重复发放。
  let result: GuideCompleteResult | null = null;
  try {
    result = await completeGuideApi();
  } catch {
    /* 本地标志已兜底，下次启动重试由云端幂等处理 */
  }
  // 奖励展示复用 preReward 缓存的结果（completeGuideApi 二次调用 reward 为 null）
  if (_preRewardResult) {
    const cached = _preRewardResult;
    _preRewardResult = null;
    return cached;
  }
  return result;
}

/** 提前发奖结果缓存（home-showcase 之后调用，用户进入 diary 时明信片已在图鉴） */
let _preRewardResult: GuideCompleteResult | null = null;

/** 提前调用云端发奖接口：把新手奖励（星星+米子星+明信片）提前写入图鉴。
 *  在 home-showcase → home-diary 推进时调用，确保 diary 页有明信片可看。
 *  结果缓存供 complete() 复用，避免重复调用云端。 */
export async function preReward(): Promise<GuideCompleteResult | null> {
  try {
    // markCompleted=false：只发奖，不写 guideCompletedAt（教程尚未走完）
    const res = await completeGuideApi(false);
    _preRewardResult = res;
    if (res.wallet) {
      setStars(res.wallet.stars);
      setRiceStars(res.wallet.riceStars);
      emit(GameEvent.STARS_UPDATED);
    }
    return res;
  } catch {
    /* 失败不阻断，complete() 时会再调一次（云端幂等） */
    return null;
  }
}

/** 订阅指引状态变化，返回退订函数 */
export function onChange(handler: (payload?: unknown) => void): () => void {
  return on(GameEvent.GUIDE_CHANGED, handler);
}

/** 从 GuideCompleteResult 构建新手奖励展示项 + 同步本地钱包余额。
 *  home / roof 共用：出发后教程改在 roof 完成时调用。 */
export async function buildGuideRewardItems(
  res: GuideCompleteResult,
): Promise<{ results: GachaResultItem[]; playSound: boolean }> {
  const reward = res.reward;
  if (!reward) return { results: [], playSound: false };
  const [starIcon, riceIcon] = await Promise.all([
    resolveAsset('roof/star'),
    resolveAsset('roof/star-rice'),
  ]);
  const results: GachaResultItem[] = [
    {
      gachaId: 'guide_stars',
      name: `星星 ×${reward.stars}`,
      icon: starIcon,
      rarity: 'N',
      duplicate: false,
    },
    {
      gachaId: 'guide_rice',
      name: `米子星 ×${reward.riceStars}`,
      icon: riceIcon,
      rarity: 'SSR',
      duplicate: false,
    },
  ];
  if (reward.postcard) {
    const icon = await resolveDynamicAsset(reward.postcard.imageThumb);
    results.push({
      gachaId: 'guide_postcard',
      name: reward.postcard.title,
      icon,
      rarity: reward.postcard.rarity || 'SR',
      duplicate: false,
    });
  }
  if (res.wallet) {
    setStars(res.wallet.stars);
    setRiceStars(res.wallet.riceStars);
    emit(GameEvent.STARS_UPDATED);
  }
  return { results, playSound: true };
}
