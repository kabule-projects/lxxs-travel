import * as guide from '../services/guide';
import type { GuideHost } from '../services/guide';
import { measureSelectors } from './guide-measure';
import type { GuideHole } from '../components/guide-overlay/guide-overlay';

/** 页面/组件实例的最小结构（Page 与 Component 的 this 均满足） */
export interface GuideHostCtx {
  data: Record<string, unknown>;
  setData(data: Record<string, unknown>): void;
  _guideStep?: string;
  _guideTimer?: number;
  _guideBlockedAt?: number;
  [key: string]: unknown;
}

interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 屋顶星星活动带：开孔外接矩形向外放宽，覆盖整堆星星的易点区域 */
function roofBand(holes: GuideHole[]): HitRect {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const winW = info.windowWidth;
  const winH = info.windowHeight || info.screenHeight || 0;
  const x1 = Math.min(...holes.map((h) => h.x));
  const y1 = Math.min(...holes.map((h) => h.y));
  const x2 = Math.max(...holes.map((h) => h.x + h.w));
  const y2 = Math.max(...holes.map((h) => h.y + h.h));
  const padX = 28;
  const padY = 36;
  const x = Math.max(0, x1 - padX);
  const y = Math.max(0, y1 - padY);
  return {
    x,
    y,
    w: Math.min(winW - x, x2 - x1 + padX * 2),
    h: Math.min(winH - y, y2 - y1 + padY * 2),
  };
}

/** 宿主在当前指引步骤下是否应显示遮罩；负责显示/隐藏与步骤切换防闪 */
export function refreshGuideHost(host: GuideHost, ctx: GuideHostCtx): void {
  if (!guide.isHost(host)) {
    if (ctx.data.guideVisible) ctx.setData({ guideVisible: false });
    return;
  }
  const meta = guide.getMeta();
  if (!meta) return;
  const stepChanged = ctx._guideStep !== meta.step;
  ctx._guideStep = meta.step;
  if (!ctx.data.guideVisible) {
    // 首次出现先全屏阻挡，测量完成前防旧屏闪烁误触
    ctx.setData({
      guideVisible: true,
      guideText: meta.text,
      guideHoles: [],
      guideHit: null,
    });
  } else {
    ctx.setData({
      guideText: meta.text,
      // 步骤切换瞬间先全屏阻挡，避免上一孔残留
      guideHoles: stepChanged ? [] : ctx.data.guideHoles,
      guideHit: stepChanged ? null : ctx.data.guideHit,
    });
  }
  void measureGuideHost(host, ctx);
}

/** 测量当前步骤目标节点并写入开孔；目标未渲染则短时重试 */
export async function measureGuideHost(
  host: GuideHost,
  ctx: GuideHostCtx,
): Promise<void> {
  if (!guide.isHost(host)) return;
  const meta = guide.getMeta();
  if (!meta) return;
  const holes = await measureSelectors(ctx, meta.selectors);
  // 异步返回后步骤可能已切换，丢弃过期测量结果
  if (!guide.isStep(meta.step)) return;
  if (!holes.length) {
    if (ctx._guideTimer) clearTimeout(ctx._guideTimer);
    ctx._guideTimer = setTimeout(() => {
      void measureGuideHost(host, ctx);
    }, 120) as unknown as number;
    return;
  }
  if (meta.hit === 'roof-band') {
    // 屋顶捡星步：整条星星活动带作为单个大开孔——
    // 带内完全透明、零遮挡、零拦截，玩家可自由点击带内任意一颗星星
    const band = roofBand(holes);
    ctx.setData({
      guideHoles: [{ ...band, r: 20 }],
      guideHit: band,
    });
    return;
  }
  ctx.setData({
    guideHoles: holes,
    guideHit: null,
  });
}

/** 遮罩暗区被点击：节流 toast（开孔抖动由组件自身处理） */
export function notifyGuideBlocked(ctx: GuideHostCtx): void {
  const now = Date.now();
  if (!ctx._guideBlockedAt || now - ctx._guideBlockedAt > 1800) {
    ctx._guideBlockedAt = now;
    wx.showToast({ title: '请先完成指引', icon: 'none' });
  }
}

/**
 * 指引期间拦截系统返回/胶囊返回（navigateBack 手势），避免中途退出导致步骤与页面错位软锁。
 * 低版本基础库无此 API 时静默跳过；reLaunch/redirectTo 不受影响。
 */
export function setGuideBackGuard(on: boolean): void {
  try {
    if (on) {
      wx.enableAlertBeforeUnload?.({ message: '新手指引还没完成，确定要离开吗？' });
    } else {
      wx.disableAlertBeforeUnload?.();
    }
  } catch {
    /* 低版本基础库不支持时忽略 */
  }
}
