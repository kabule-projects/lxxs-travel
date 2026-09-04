import type { GachaCatalogItem } from '../../services/gacha';
import { COMMON_ASSETS, GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    items: { type: Array, value: [] },
  },

  data: {
    panelBg: '',
    itemBg: '',
    iconClose: '',
    lockIcon: '',
  },

  lifetimes: {
    attached() {
      /** 图鉴弹窗复用扭蛋结果弹窗的奶白面板底图（catalog-panel 实为物品格星爆底图，勿作面板） */
      resolveAsset(GACHA_ASSETS.resultPanel).then((panelBg) => {
        this.setData({ panelBg });
      });
      /** 与结果弹窗共用物品格底图 */
      resolveAsset(GACHA_ASSETS.resultItemBg).then((itemBg) => {
        this.setData({ itemBg });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      resolveAsset(GACHA_ASSETS.prizeLocked).then((lockIcon) => {
        this.setData({ lockIcon });
      });
    },
  },

  methods: {
    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
  },
});
