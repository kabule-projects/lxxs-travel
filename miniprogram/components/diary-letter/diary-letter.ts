import { LETTER_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';

const DEFAULT_SIGN = '——旅行小深';

type LetterAssets = {
  dateLabel: string;
  weatherSun: string;
  weatherSunset: string;
  paper: string;
  logo: string;
  btnClaim: string;
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
    showClaim: { type: Boolean, value: false },
    signature: { type: String, value: '' },
  },

  data: {
    bodyText: '',
    signText: DEFAULT_SIGN,
    assets: {
      dateLabel: '',
      weatherSun: '',
      weatherSunset: '',
      paper: '',
      logo: '',
      btnClaim: '',
    } as LetterAssets,
  },

  lifetimes: {
    attached() {
      resolveAssetMap(LETTER_ASSETS).then((assets) => {
        this.setData({ assets });
      });
    },
  },

  observers: {
    story(story: string) {
      this.applyStory(story, this.properties.signature as string);
    },
    signature(sign: string) {
      this.applyStory(this.properties.story as string, sign);
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
    onClaim() {
      this.triggerEvent('claim');
    },
  },
});
