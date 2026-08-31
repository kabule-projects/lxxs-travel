import { COMMON_ASSETS, GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

export interface GachaResultItem {
  gachaId: string;
  name: string;
  icon: string;
  rarity: string;
  duplicate: boolean;
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    results: { type: Array, value: [] },
    iconStar: { type: String, value: '' },
  },

  data: {
    topRow: [] as GachaResultItem[],
    bottomRow: [] as GachaResultItem[],
    single: true,
    convertFlags: [] as boolean[],
    panelBg: '',
    btnConfirm: '',
    iconClose: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(GACHA_ASSETS.resultPanel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(GACHA_ASSETS.btnConfirm).then((btnConfirm) => {
        this.setData({ btnConfirm });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
    },
  },

  observers: {
    'visible, results'(visible: boolean, results: GachaResultItem[]) {
      if (!visible || !results?.length) {
        this.setData({ convertFlags: [] });
        return;
      }
      const single = results.length === 1;
      const topRow = single ? results : results.slice(0, 3);
      const bottomRow = single ? [] : results.slice(3);
      const convertFlags = results.map(() => false);
      this.setData({ single, topRow, bottomRow, convertFlags });
      results.forEach((r, i) => {
        if (!r.duplicate) return;
        setTimeout(() => {
          if (!this.data.visible) return;
          this.setData({ [`convertFlags[${i}]`]: true });
        }, 450 + i * 180);
      });
    },
  },

  methods: {
    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },
  },
});
