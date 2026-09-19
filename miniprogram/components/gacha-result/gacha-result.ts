import { COMMON_ASSETS, GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  notifyGuideBlocked,
  type GuideHostCtx,
} from '../../utils/guide-page';
import type { GuideHole } from '../guide-overlay/guide-overlay';

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
    /** 面板顶部标题（如教程完成奖励）；为空不渲染 */
    title: { type: String, value: '' },
  },

  data: {
    topRow: [] as GachaResultItem[],
    bottomRow: [] as GachaResultItem[],
    single: true,
    convertFlags: [] as boolean[],
    panelBg: '',
    itemBg: '',
    btnConfirm: '',
    iconClose: '',
    /** 新手指引：结果确认步隐藏关闭钮并显示强制遮罩 */
    guideActive: false,
    guideVisible: false,
    guideHoles: [] as GuideHole[],
    guideHit: null as { x: number; y: number; w: number; h: number } | null,
    guideText: '',
  },

  _offGuide: null as (() => void) | null,
  _guideStep: '' as string,
  _guideTimer: 0 as number,
  _guideBlockedAt: 0 as number,

  lifetimes: {
    attached() {
      resolveAsset(GACHA_ASSETS.resultPanel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(GACHA_ASSETS.resultItemBg).then((itemBg) => {
        this.setData({ itemBg });
      });
      resolveAsset(GACHA_ASSETS.btnConfirm).then((btnConfirm) => {
        this.setData({ btnConfirm });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      this._offGuide = guide.onChange(() => {
        this.refreshGuide();
      });
      this.refreshGuide();
    },

    detached() {
      this._offGuide?.();
      if (this._guideTimer) clearTimeout(this._guideTimer);
    },
  },

  observers: {
    'visible, results'(visible: boolean, results: GachaResultItem[]) {
      if (!visible || !results?.length) {
        this.setData({ convertFlags: [] });
        this.refreshGuide();
        return;
      }
      this.refreshGuide();
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
      // 指引结果确认步：禁止点遮罩/X 关闭，只能点确认
      if (guide.isStep('gacha-result')) return;
      this.triggerEvent('close');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },

    /** 新手指引：仅在弹窗可见且处于 gacha-result 步时接管遮罩 */
    refreshGuide() {
      const guideActive = guide.isStep('gacha-result');
      this.setData({ guideActive });
      if (!this.data.visible || !guideActive) {
        if (this.data.guideVisible) this.setData({ guideVisible: false });
        return;
      }
      refreshGuideHost('gacha-result', this as unknown as GuideHostCtx);
    },

    onGuideBlocked() {
      notifyGuideBlocked(this as unknown as GuideHostCtx);
    },
  },
});
