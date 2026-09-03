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
    signText: DEFAULT_SIGN,
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
      this.setData({
        bodyText: parsed.body,
        signText: (signature || '').trim() || parsed.sign,
      });
    },

    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
  },
});
