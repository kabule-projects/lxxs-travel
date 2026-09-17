import type { GuideHole } from '../components/guide-overlay/guide-overlay';

interface RawRect {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

function toHoles(group: unknown, r: number): GuideHole[] {
  const list = Array.isArray(group) ? group : group ? [group] : [];
  const holes: GuideHole[] = [];
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
      holes.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height, r });
    }
  });
  return holes;
}

/**
 * 在页面/组件内测量一批选择器的视口矩形（boundingClientRect 坐标）。
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
