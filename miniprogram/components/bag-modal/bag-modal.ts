import GAME from '../../utils/constants';
import { getRiceStars } from '../../store/user';
import type { InvCategory, InvItemView } from '../../services/inventory';
import { BAG_ASSETS, COMMON_ASSETS, ROOF_ASSETS } from '../../utils/asset-path';
import { resolveAsset, resolveAssetMap } from '../../utils/resolve-assets';
import { GameEvent, on } from '../../utils/event-bus';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  notifyGuideBlocked,
  type GuideHostCtx,
} from '../../utils/guide-page';
import type { GuideHole } from '../guide-overlay/guide-overlay';

interface SlotItem {
  id: string;
  name: string;
  icon: string;
}

type BagAssets = Record<keyof typeof BAG_ASSETS, string>;

Component({
  properties: {
    visible: { type: Boolean, value: false },
  },

  data: {
    food: null as SlotItem | null,
    riceStar: false,
    riceCount: 0,
    props: [null, null] as Array<SlotItem | null>,
    pickerVisible: false,
    pickerLock: '' as InvCategory | '',
    propTarget: 0,
    assets: {} as BagAssets,
    iconClose: '',
    /** 新手指引：bag-food/bag-prop/bag-depart 三步的组件内强制遮罩 */
    guideActive: false,
    guideVisible: false,
    guideHoles: [] as GuideHole[],
    guideHit: null as { x: number; y: number; w: number; h: number } | null,
    guideText: '',
  },

  _offTripStarted: null as (() => void) | null,
  _offGuide: null as (() => void) | null,
  _guideStep: '' as string,
  _guideTimer: 0 as number,
  _guideBlockedAt: 0 as number,

  lifetimes: {
    attached() {
      resolveAssetMap(BAG_ASSETS).then((assets) => {
        this.setData({ assets });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      resolveAsset(ROOF_ASSETS.starRice).then((riceIcon) => {
        this.setData({ riceIcon });
      });
      this._offTripStarted = on(GameEvent.TRIP_STARTED, () => {
        this.resetLoadout();
      });
      this._offGuide = guide.onChange(() => {
        this.refreshGuide();
      });
    },
    detached() {
      this._offTripStarted?.();
      this._offTripStarted = null;
      this._offGuide?.();
      if (this._guideTimer) clearTimeout(this._guideTimer);
    },
  },

  observers: {
    visible(v: boolean) {
      if (v) {
        this.setData({
          riceCount: getRiceStars(),
          pickerVisible: false,
        });
      }
      this.refreshGuide();
    },
  },

  methods: {
    onStop() {},

    onClose() {
      // 指引中背包不可关闭（遮罩/X/返回均锁定直到出发完成）
      if (guide.isActive()) return;
      if (this.data.pickerVisible) {
        this.setData({ pickerVisible: false });
        return;
      }
      this.triggerEvent('close');
    },

    resetLoadout() {
      this.setData({
        food: null,
        riceStar: false,
        props: [null, null],
        pickerVisible: false,
      });
    },

    onTapFood() {
      if (this.data.food) return;
      this.setData({
        pickerVisible: true,
        pickerLock: 'food',
      });
      // 指引：打开食物选择器并推进（选择器内部遮罩接管）
      if (guide.isStep('bag-food')) guide.advance('picker-food');
    },

    onClearFood() {
      if (guide.isActive()) return;
      this.setData({ food: null });
    },

    onTapRice() {
      if (guide.isActive()) return;
      if (this.data.riceStar) return;
      const count = getRiceStars();
      if (count <= 0) return;
      this.setData({ riceStar: true, riceCount: count });
    },

    onClearRice() {
      if (guide.isActive()) return;
      this.setData({ riceStar: false });
    },

    onTapProp(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index);
      if (Number.isNaN(index)) return;
      // 指引装道具步：仅第一个道具槽放行
      if (guide.isActive() && !(guide.isStep('bag-prop') && index === 0)) return;
      if (this.data.props[index]) return;
      this.setData({
        pickerVisible: true,
        pickerLock: 'prop',
        propTarget: index,
      });
      if (guide.isStep('bag-prop')) guide.advance('picker-prop');
    },

    onClearProp(e: WechatMiniprogram.TouchEvent) {
      if (guide.isActive()) return;
      const index = Number(e.currentTarget.dataset.index);
      const props = [...this.data.props];
      props[index] = null;
      this.setData({ props });
    },

    onPickerClose() {
      if (guide.isActive()) return;
      this.setData({ pickerVisible: false });
    },

    onPickerSelect(e: WechatMiniprogram.CustomEvent) {
      const item = (e.detail as { item?: InvItemView }).item;
      if (!item) return;

      if (this.data.pickerLock === 'food') {
        this.setData({
          food: { id: item.id, name: item.name, icon: item.icon },
          pickerVisible: false,
        });
        // 指引：食物入包后推进到装道具步（本组件遮罩重新接管）
        if (guide.isStep('picker-food')) guide.advance('bag-prop');
        return;
      }

      const target = this.data.propTarget;
      const props = [...this.data.props];
      const already = props.some((p, i) => p && p.id === item.id && i !== target);
      if (already) {
        wx.showToast({ title: '该道具已在背包中', icon: 'none' });
        return;
      }
      props[target] = { id: item.id, name: item.name, icon: item.icon };
      this.setData({ props, pickerVisible: false });
      if (guide.isStep('picker-prop')) guide.advance('bag-depart');
    },

    onDepart() {
      // 指引中只有出发步可点 GO
      if (guide.isActive() && !guide.isStep('bag-depart')) return;
      const { food, riceStar, props } = this.data;
      const propIds = props
        .filter(Boolean)
        .map((p) => (p as SlotItem).id)
        .slice(0, GAME.BAG_PROP_SLOTS);

      this.setData({ pickerVisible: false });
      this.triggerEvent('depart', {
        loadout: {
          // 允许空手出门：服务端走 food_pools 的 empty 配置（80% 迷路、无伴手礼）
          bento: food ? food.id : '',
          riceStar: !!riceStar,
          props: propIds,
        },
      });
    },

    /** 新手指引：背包可见且处于 bag-modal 宿主步骤（bag-food/bag-prop/bag-depart）时显示遮罩；
     *  picker-* 步隐藏（inventory-picker 组件内部遮罩接管） */
    refreshGuide() {
      const guideActive = guide.isActive();
      this.setData({ guideActive });
      if (!this.data.visible || !guide.isHost('bag-modal')) {
        if (this.data.guideVisible) this.setData({ guideVisible: false });
        return;
      }
      refreshGuideHost('bag-modal', this as unknown as GuideHostCtx);
    },

    onGuideBlocked() {
      notifyGuideBlocked(this as unknown as GuideHostCtx);
    },
  },
});
