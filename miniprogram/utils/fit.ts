/**
 * 设计舞台适配：短宽屏（屏比低于阈值）下把「宽度对齐」改成「高度对齐」。
 *
 * 背景：整套 UI 按宽度对齐（1rpx = 屏宽/750），设计画布为 750rpx × 1624rpx
 * （≈2.165:1，与各页背景切图帧一致）。屏比低于画布比例的机型（如 18:9≈2.0、
 * 16:9≈1.78）上，固定 rpx 定高的背景比屏幕高、被上下裁切，而按视口百分比定位的
 * 热区/角色又和背景对不上——两套坐标系发散，底部内容不可用。
 *
 * 方案：所有页面内容放进统一的「设计舞台」容器（固定 750rpx × 1624rpx，垂直居中），
 * 屏比低于阈值时整幅画布等比缩小到贴合屏高（两侧留白，露出页面底色），
 * 舞台内 % / rpx 全部按画布解析，背景与热区重新对齐。
 *
 * 换算：舞台垂直居中，屏幕坐标 s 与舞台坐标 l 的关系为
 *   s = (H - k·stageH) / 2 + k·l
 * 顶/底锚定同式（舞台上下居中，两端偏移相同）。
 */

const STAGE_W_RPX = 750;
const STAGE_H_RPX = 1624;
/** 设计画布比例（= 背景切图帧 828×1792） */
const STAGE_RATIO = STAGE_H_RPX / STAGE_W_RPX;

/**
 * 屏比阈值：低于此值改为高度对齐；≥ 此值维持原宽度对齐（上下最多裁切约 4%）。
 * 真实机型可分两档：18:9 = 2.0 与 16:9 = 1.78 会触发；19.5:9 ≈ 2.167 及以上不触发。
 */
const MIN_RATIO = 2.1;

export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FitInfo {
  /** 屏比 windowHeight / windowWidth */
  ratio: number;
  /** 是否启用高度对齐 */
  scaled: boolean;
  /** 舞台缩放系数（1 = 不缩放） */
  k: number;
  /** 舞台未缩放时的 CSS px 尺寸（= 屏宽 × 画布比例） */
  stageW: number;
  stageH: number;
  /** 舞台左上角在屏幕中的位置（px）；水平居中 */
  offsetX: number;
  offsetY: number;
  /** 舞台内联样式（含 transform）；不缩放时为空串，走全局 .fit-stage 样式 */
  stageStyle: string;
  /** 屏幕 px（自顶/自底锚定）→ 舞台 px */
  toStageY(px: number): number;
  /** 屏幕 px（自左锚定）→ 舞台 px */
  toStageX(px: number): number;
  /** 视口矩形（boundingClientRect 口径）→ 舞台矩形 */
  rectToStage(r: { left: number; top: number; width: number; height: number }): StageRect;
}

let cached: (FitInfo & { _w: number; _h: number }) | null = null;

function compute(): FitInfo {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const w = info.windowWidth || 375;
  const h = info.windowHeight || 667;
  const ratio = h / w;
  const stageW = w; // 750rpx 恒等于屏宽
  const stageH = w * STAGE_RATIO;
  const scaled = ratio < MIN_RATIO;
  const k = scaled ? ratio / STAGE_RATIO : 1;
  const offsetX = (w - k * stageW) / 2;
  const offsetY = (h - k * stageH) / 2;

  return {
    ratio,
    scaled,
    k,
    stageW,
    stageH,
    offsetX,
    offsetY,
    stageStyle: scaled ? `transform: translateY(-50%) scale(${k.toFixed(5)});` : '',
    toStageY: (px: number) => (px - offsetY) / k,
    toStageX: (px: number) => (px - offsetX) / k,
    rectToStage: (r) => ({
      x: (r.left - offsetX) / k,
      y: (r.top - offsetY) / k,
      w: r.width / k,
      h: r.height / k,
    }),
  };
}

/**
 * 当前设备的舞台适配信息。缓存按窗口尺寸校验：iPad 旋转、分屏、
 * 折叠态切换等导致 windowWidth/Height 变化时自动重算，无需手动失效。
 */
export function getFit(): FitInfo {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const w = info.windowWidth || 375;
  const h = info.windowHeight || 667;
  if (!cached || cached._w !== w || cached._h !== h) {
    cached = Object.assign(compute(), { _w: w, _h: h });
  }
  return cached;
}

/**
 * 页面接入设计舞台：立即写入 stageStyle，并在窗口尺寸变化（iPad 旋转、
 * 分屏、折叠态切换）时自动重算。各页 onLoad 调用一次即可。
 * 注意：页内其他按屏幕 px 换算的布局（hudTop/footerBottom 等）只在进页时
 * 取一次 getFit()，旋转后需重新进页才更新；stage 缩放与背景对齐始终正确。
 */
export function bindStageFit(page: {
  setData(data: Record<string, unknown>): void;
  onResize?: (...args: never[]) => void;
}): void {
  const apply = (): void => {
    page.setData({ stageStyle: getFit().stageStyle });
  };
  const prev = page.onResize;
  page.onResize = function (this: unknown, ...args: never[]) {
    apply();
    if (prev) prev.apply(this, args);
  };
  apply();
}

export { MIN_RATIO, STAGE_RATIO, STAGE_W_RPX, STAGE_H_RPX };
