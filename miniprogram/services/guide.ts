import { completeGuideApi } from './api';
import type { UserProfile } from './api';
import { emit, on, GameEvent } from '../utils/event-bus';

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

/** 指引步骤（固定顺序，13 步） */
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
  | 'bag-depart';

/** 步骤所属宿主：页面或自定义组件（组件隔离下遮罩需组件内部渲染） */
export type GuideHost =
  | 'roof'
  | 'shop'
  | 'gacha'
  | 'home'
  | 'bag-modal'
  | 'inventory-picker'
  | 'gacha-result';

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

/** 冷启动激活：清零本地教学经济缓存，固定从首步开始 */
export function start(): void {
  if (state.completed || state.active) return;
  try {
    LOCAL_ECONOMY_KEYS.forEach((key) => wx.setStorageSync(key, ''));
  } catch {
    /* ignore */
  }
  state.active = true;
  state.step = GUIDE_ORDER[0];
  emitChanged();
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

/** 推进到指定步骤；缺省按 GUIDE_ORDER 前进一步 */
export function advance(next?: GuideStep): void {
  if (!state.active || !state.step) return;
  const target =
    next || GUIDE_ORDER[Math.min(GUIDE_ORDER.indexOf(state.step) + 1, GUIDE_ORDER.length - 1)];
  if (target === state.step) return;
  state.step = target;
  emitChanged();
}

/** 指引完成（真实出发成功）：本地立即生效，云端回写失败不阻断 */
export async function complete(): Promise<void> {
  if (state.completed) return;
  state.completed = true;
  state.active = false;
  state.step = null;
  try {
    wx.setStorageSync(GUIDE_COMPLETED_KEY, Date.now());
  } catch {
    /* ignore */
  }
  emitChanged();
  try {
    await completeGuideApi();
  } catch {
    /* 本地标志已兜底，下次启动重试由云端幂等处理 */
  }
}

/** 订阅指引状态变化，返回退订函数 */
export function onChange(handler: (payload?: unknown) => void): () => void {
  return on(GameEvent.GUIDE_CHANGED, handler);
}
