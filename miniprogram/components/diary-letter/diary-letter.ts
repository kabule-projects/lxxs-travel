import { LETTER_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';

const DEFAULT_SIGN = '——旅行小深';

type LetterAssets = {
  paper: string;
};

function splitStory(raw: string): { body: string; sign: string } {
  const text = (raw || '').trim();
  if (!text) return { body: '', sign: DEFAULT_SIGN };

  const idx = text.lastIndexOf('——');
  if (idx >= 0) {
    const body = text.slice(0, idx).trim();
    const sign = text.slice(idx).trim();
    return {
      body: body || text,
      sign: sign || DEFAULT_SIGN,
    };
  }

  return { body: text, sign: DEFAULT_SIGN };
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    dateText: { type: String, value: '' },
    story: { type: String, value: '' },
    title: { type: String, value: '' },
    signature: { type: String, value: '' },
    /** 展开信件时自动触发 claim（信箱用；日记已入库无需） */
    autoClaim: { type: Boolean, value: false },
  },

  data: {
    bodyText: '',
    paragraphs: [] as string[],
    signText: DEFAULT_SIGN,
    /** 字号基准：信纸渲染宽 × 5%，正文中所有 em 尺寸随信纸等比缩放 */
    fontBase: 15,
    assets: {
      paper: '',
    } as LetterAssets,
  },

  _claimedThisOpen: false,

  lifetimes: {
    attached() {
      resolveAssetMap(LETTER_ASSETS).then((assets) => {
        this.setData({ assets });
      });
    },
  },

  observers: {
    visible(v: boolean) {
      if (!v) {
        this._claimedThisOpen = false;
        return;
      }
      this.applyStory(
        this.properties.story as string,
        this.properties.signature as string,
      );
      this.measurePaper();
      if (this.properties.autoClaim && !this._claimedThisOpen) {
        this._claimedThisOpen = true;
        this.triggerEvent('claim');
      }
    },
    story(story: string) {
      if (this.properties.visible) {
        this.applyStory(story, this.properties.signature as string);
      }
    },
    signature(sign: string) {
      if (this.properties.visible) {
        this.applyStory(this.properties.story as string, sign);
      }
    },
  },

  methods: {
    applyStory(story: string, signature: string) {
      const parsed = splitStory(story);
      // 按换行拆成段落，过滤空行，供每段首行缩进渲染
      const paragraphs = parsed.body
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      this.setData({
        bodyText: parsed.body,
        paragraphs,
        signText: (signature || '').trim() || parsed.sign,
      });
    },

    /** 测量信纸实际渲染宽度，按比例设定字号基准，使文字排版锁定信纸坐标系 */
    measurePaper() {
      wx.nextTick(() => {
        this.createSelectorQuery()
          .select('.dl-paper')
          .boundingClientRect((rect: { width?: number } | null) => {
            const w = rect && rect.width;
            if (w) this.setData({ fontBase: w * 0.05 });
          })
          .exec();
      });
    },

    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
  },
});
