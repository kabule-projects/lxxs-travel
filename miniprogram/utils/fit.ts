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

let cached: FitInfo | null = null;

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

/** 当前设备的舞台适配信息（会话内缓存；窗口尺寸不变，无需重复读取） */
export function getFit(): FitInfo {
  if (!cached) cached = compute();
  return cached;
}

export { MIN_RATIO, STAGE_RATIO, STAGE_W_RPX, STAGE_H_RPX };
