import { getFit } from '../../utils/fit';

/** 开孔矩形（舞台 px 坐标，见 utils/fit.ts） */
export interface GuideHole {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

interface BubbleLayout {
  show: boolean;
  below: boolean;
  x: number;
  w: number;
  /** 小三角相对气泡左边的偏移（px） */
  arrowX: number;
  /** 垂直定位内联样式：上方放置用 bottom 锚定（底边对齐开孔上沿），下方放置用 top */
  posStyle: string;
}

const GAP = 16;
const SIDE = 12;

Component({
  properties: {
    visible: { type: Boolean, value: false },
    /** 视觉开孔，可多个（如屋顶 9 颗星） */
    holes: { type: Array, value: [] as GuideHole[] },
    /** 交互放行矩形；缺省取所有开孔外接矩形。屋顶步骤传星星活动带 */
    hitRect: {
      type: Object,
      value: null as ({ x: number; y: number; w: number; h: number } | null),
    },
    text: { type: String, value: '' },
    /** 无遮罩模式：只显示文字气泡和开孔白边，不渲染半透明黑色遮罩。
     *  用于弹窗内的引导步骤（如 diary-envelope），弹窗本身已有背景。 */
    noMask: { type: Boolean, value: false },
  },

  data: {
    winW: 0,
    winH: 0,
    /** 开孔测量完成前全屏不可点，防旧屏闪烁误触 */
    fullBlock: true,
    hit: { x: 0, y: 0, w: 0, h: 0 },
    bar: {
      top: 0,
      bottomY: 0,
      bottom: 0,
      left: 0,
      rightX: 0,
      right: 0,
      midY: 0,
      midH: 0,
    },
    bubble: { show: false, below: true, x: 0, w: 0, arrowX: 0, posStyle: '' } as BubbleLayout,
    shake: false,
  },

  /** 开孔抖动复位计时器（onBlocked 触发，360ms 复位） */
  _shakeTimer: 0 as number,

  lifetimes: {
    attached() {
      // 遮罩与开孔都按舞台（设计画布）坐标绘制：窗口尺寸取舞台尺寸而非视口尺寸
      const fit = getFit();
      this.setData({
        winW: fit.stageW,
        winH: fit.stageH,
      });
      this.relayout();
    },

    detached() {
      if (this._shakeTimer) clearTimeout(this._shakeTimer);
    },
  },

  observers: {
    'visible, holes, hitRect, text'() {
      this.relayout();
    },
  },

  methods: {
    /** 开孔外接矩形 */
    bbox(holes: GuideHole[]) {
      if (!holes.length) return null;
      const x1 = Math.min(...holes.map((h) => h.x));
      const y1 = Math.min(...holes.map((h) => h.y));
      const x2 = Math.max(...holes.map((h) => h.x + h.w));
      const y2 = Math.max(...holes.map((h) => h.y + h.h));
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    },

    relayout() {
      if (!this.data.visible) return;
      const { winW, winH } = this.data;
      if (!winW || !winH) return;

      const holes = (this.data.holes || []) as GuideHole[];
      const hit = this.data.hitRect || this.bbox(holes);
      if (!hit) {
        this.setData({ fullBlock: true, bubble: { ...this.data.bubble, show: false } });
        return;
      }

      const bar = {
        top: Math.max(0, hit.y),
        bottomY: hit.y + hit.h,
        bottom: Math.max(0, winH - hit.y - hit.h),
        left: Math.max(0, hit.x),
        rightX: hit.x + hit.w,
        right: Math.max(0, winW - hit.x - hit.w),
        midY: hit.y,
        midH: hit.h,
      };
      this.setData({ fullBlock: false, hit, bar });
      this.layoutBubble(hit);
    },

    layoutBubble(hit: { x: number; y: number; w: number; h: number }) {
      const { winW, winH, text } = this.data;
      const w = Math.min(winW - SIDE * 2, 300);
      // 估算文案行数与气泡高度（15px/字、22px 行高），仅用于判断放上方还是下方
      const perLine = Math.max(6, Math.floor((w - 28) / 15));
      const lines = Math.max(1, Math.min(3, Math.ceil((text || '').length / perLine)));
      const bubbleH = lines * 22 + 22;
      const centerX = hit.x + hit.w / 2;
      const x = Math.min(Math.max(SIDE, centerX - w / 2), winW - SIDE - w);
      const spaceAbove = hit.y;
      const spaceBelow = winH - hit.y - hit.h;
      const below = spaceBelow < bubbleH + GAP && spaceAbove >= bubbleH + GAP ? false : true;
      // 上方放置按「下边缘」锚定（bottom 定位）：气泡实际高度随文本换行/字体渲染变化，
      // 用 top+估算高度会把气泡底边推进开孔；bottom 锚定保证底边恒在开孔上方 GAP 处
      const posStyle = below
        ? `top:${hit.y + hit.h + GAP}px;`
        : `bottom:${winH - hit.y + GAP}px;`;
      const arrowX = Math.min(Math.max(24, centerX - x), w - 24);
      this.setData({
        bubble: { show: !!text, below, x, w, arrowX, posStyle },
      });
    },

    onBlocked() {
      this.triggerEvent('blocked');
      if (this._shakeTimer) clearTimeout(this._shakeTimer as number);
      this.setData({ shake: true });
      this._shakeTimer = setTimeout(() => {
        this.setData({ shake: false });
      }, 360) as unknown as number;
    },
  },
});
