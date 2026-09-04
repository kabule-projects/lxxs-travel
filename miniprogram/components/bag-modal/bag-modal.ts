import GAME from '../../utils/constants';
import { getRiceStars } from '../../store/user';
import { getItemMeta } from '../../services/inventory';
import type { InvCategory, InvItemView } from '../../services/inventory';
import { BAG_ASSETS, COMMON_ASSETS } from '../../utils/asset-path';
import { resolveAsset, resolveAssetMap } from '../../utils/resolve-assets';
import { GameEvent, on } from '../../utils/event-bus';

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
  },

  _offTripStarted: null as (() => void) | null,

  lifetimes: {
    attached() {
      resolveAssetMap(BAG_ASSETS).then((assets) => {
        this.setData({ assets });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      this._offTripStarted = on(GameEvent.TRIP_STARTED, () => {
        this.resetLoadout();
      });
    },
    detached() {
      this._offTripStarted?.();
      this._offTripStarted = null;
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
    },
  },

  methods: {
    onStop() {},

    onClose() {
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
    },

    onClearFood() {
      this.setData({ food: null });
    },

    onTapRice() {
      if (this.data.riceStar) return;
      const count = getRiceStars();
      if (count <= 0) return;
      this.setData({ riceStar: true, riceCount: count });
    },

    onClearRice() {
      this.setData({ riceStar: false });
    },

    onTapProp(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index);
      if (Number.isNaN(index)) return;
      if (this.data.props[index]) return;
      this.setData({
        pickerVisible: true,
        pickerLock: 'prop',
        propTarget: index,
      });
    },

    onClearProp(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index);
      const props = [...this.data.props];
      props[index] = null;
      this.setData({ props });
    },

    onPickerClose() {
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
    },

    onDepart() {
      const { food, riceStar, props } = this.data;
      if (!food) {
        wx.showToast({ title: '需要准备食物', icon: 'none' });
        return;
      }

      const propIds = props
        .filter(Boolean)
        .map((p) => (p as SlotItem).id)
        .slice(0, GAME.BAG_PROP_SLOTS);

      if (!getItemMeta(food.id)) {
        wx.showToast({ title: '食物无效', icon: 'none' });
        return;
      }

      this.setData({ pickerVisible: false });
      this.triggerEvent('depart', {
        loadout: {
          bento: food.id,
          riceStar: !!riceStar,
          props: propIds,
        },
      });
    },
  },
});
