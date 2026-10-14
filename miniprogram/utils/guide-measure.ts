import type { GuideHole } from '../components/guide-overlay/guide-overlay';
import { getFit } from './fit';

interface RawRect {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

function toHoles(group: unknown, r: number): GuideHole[] {
  const list = Array.isArray(group) ? group : group ? [group] : [];
  const holes: GuideHole[] = [];
  // boundingClientRect 返回屏幕（视口）坐标；舞台内的遮罩按舞台坐标绘制，
  // 短宽屏整体缩小时需换算回画布坐标（k=1 时仅去掉舞台的居中偏移，≈0）
  const fit = getFit();
  list.forEach((item) => {
    const rect = item as RawRect;
    if (
      typeof rect.left === 'number' &&
      typeof rect.top === 'number' &&
      typeof rect.width === 'number' &&
      typeof rect.height === 'number' &&
      rect.width > 0 &&
      rect.height > 0
    ) {
      const r2 = fit.rectToStage({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
      holes.push({ x: r2.x, y: r2.y, w: r2.w, h: r2.h, r });
    }
  });
  return holes;
}

/**
 * 在页面/组件内测量一批选择器的视口矩形（boundingClientRect 坐标），
 * 并换算为舞台（设计画布）坐标供遮罩开孔使用。
 * 每个 selector 按 selectAll 查询，多开孔自动拍平。
 */
export function measureSelectors(
  ctx: unknown,
  selectors: string[],
  radius = 12,
): Promise<GuideHole[]> {
  return new Promise((resolve) => {
    const query = wx.createSelectorQuery().in(ctx);
    selectors.forEach((sel) => {
      query.selectAll(sel).boundingClientRect();
    });
    query.exec((res: unknown[]) => {
      const groups = Array.isArray(res) ? res : [];
      const holes = groups.reduce<GuideHole[]>(
        (acc, group) => acc.concat(toHoles(group, radius)),
        [],
      );
      resolve(holes);
    });
  });
}
