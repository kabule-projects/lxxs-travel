/** 明信片大图弹层（diary / mail 共用）：
 * 裸图 3:4 盒子 + aspectFit；信封按钮动态跟随图片右下角。
 * 微调信封溢出量改 OVERFLOW_RIGHT / OVERFLOW_BOTTOM。 */
const OVERFLOW_RIGHT = -5; // 相对卡片宽度的右溢出百分比
const OVERFLOW_BOTTOM = -27; // 相对卡片高度的底部溢出百分比
const CARD_AR = 3 / 4;

Component({
  properties: {
    /** 明信片大图地址（空则显示 title 首字占位） */
    image: { type: String, value: '' },
    title: { type: String, value: '' },
    /** 信封按钮贴图 */
    envelope: { type: String, value: '' },
  },

  data: {
    envelopeRight: OVERFLOW_RIGHT,
    envelopeBottom: OVERFLOW_BOTTOM,
  },

  observers: {
    /** 换图时先回到默认位，待新图 bindload 重新贴合 */
    image() {
      this.setData({
        envelopeRight: OVERFLOW_RIGHT,
        envelopeBottom: OVERFLOW_BOTTOM,
      });
    },
  },

  methods: {
    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
    onTapEnvelope() {
      this.triggerEvent('envelope');
    },

    /** 大图加载后按图片实际比例计算信封位置，使其贴合图片右下角 */
    onImageLoad(e: WechatMiniprogram.ImageLoad) {
      const { width: imgW, height: imgH } = e.detail;
      if (!imgW || !imgH) return;
      const imgAR = imgW / imgH;
      if (imgAR >= CARD_AR) {
        // 图片更宽：填满卡片宽度，上下有留白 → 只需调 bottom
        const renderedImgHPct = (100 * 3) / (4 * imgAR);
        const marginPct = (100 - renderedImgHPct) / 2;
        this.setData({
          envelopeRight: OVERFLOW_RIGHT,
          envelopeBottom: marginPct + OVERFLOW_BOTTOM,
        });
      } else {
        // 图片更高：填满卡片高度，左右有留白 → 只需调 right
        const renderedImgWPct = (100 * 4 * imgAR) / 3;
        const marginPct = (100 - renderedImgWPct) / 2;
        this.setData({
          envelopeRight: marginPct + OVERFLOW_RIGHT,
          envelopeBottom: OVERFLOW_BOTTOM,
        });
      }
    },
  },
});
