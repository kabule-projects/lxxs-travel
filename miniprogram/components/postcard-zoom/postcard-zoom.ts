/** 明信片大图弹层（diary / mail 共用）：
 * 裸图 3:4 盒子 + aspectFit；信封按钮动态跟随图片右下角。
 * 微调信封溢出量改 OVERFLOW_RIGHT / OVERFLOW_BOTTOM。
 * 大图走本地持久化缓存：首次查看下载存本地，之后零 CDN 流量（utils/image-cache） */
import { resolvePersistentImage } from '../../utils/image-cache';

const OVERFLOW_RIGHT = -5; // 相对卡片宽度的右溢出百分比
// 相对卡片高度的底部溢出百分比（盒子原为 image 默认高 225px、图居中；
// 盒子修正为贴齐切图后，换算为图下沿位置 ≈ -8% 才能保持原视觉）
const OVERFLOW_BOTTOM = -8;
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
    /** 本地持久化后的路径；解析完成前先用原地址展示 */
    localImage: '',
  },

  observers: {
    /** 换图时先回到默认位，待新图 bindload 重新贴合；同时解析本地缓存路径 */
    image(src: string) {
      this.setData({
        envelopeRight: OVERFLOW_RIGHT,
        envelopeBottom: OVERFLOW_BOTTOM,
        localImage: '',
      });
      if (!src) return;
      const seq = (this._imgSeq = (this._imgSeq || 0) + 1);
      void resolvePersistentImage(src).then((local) => {
        // 竞态防护：解析返回时若已换图则丢弃
        if (this._imgSeq === seq) this.setData({ localImage: local });
      });
    },
  },

  _imgSeq: 0 as number,

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
