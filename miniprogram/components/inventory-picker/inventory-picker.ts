import {
  fetchOwned,
  type InvCategory,
  type InvItemView,
} from '../../services/inventory';
import { COMMON_ASSETS, INVENTORY_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    lockTab: { type: String, value: '' },
  },

  data: {
    tab: 'food' as InvCategory,
    items: [] as InvItemView[],
    panelBg: '',
    iconClose: '',
    tabFood: '',
    tabFoodOn: '',
    tabProp: '',
    tabPropOn: '',
    itemRowBg: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(INVENTORY_ASSETS.panel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
      });
      resolveAsset(INVENTORY_ASSETS.tabFood).then((tabFood) => {
        this.setData({ tabFood });
      });
      resolveAsset(INVENTORY_ASSETS.tabFoodOn).then((tabFoodOn) => {
        this.setData({ tabFoodOn });
      });
      resolveAsset(INVENTORY_ASSETS.tabProp).then((tabProp) => {
        this.setData({ tabProp });
      });
      resolveAsset(INVENTORY_ASSETS.tabPropOn).then((tabPropOn) => {
        this.setData({ tabPropOn });
      });
      resolveAsset(INVENTORY_ASSETS.itemRow).then((itemRowBg) => {
        this.setData({ itemRowBg });
      });
    },
  },

  observers: {
    visible(v: boolean) {
      if (v) this.refresh();
    },
    lockTab() {
      if (this.properties.visible) this.refresh();
    },
  },

  methods: {
    onStop() {},

    onClose() {
      this.triggerEvent('close');
    },

    async refresh() {
      const lock = (this.properties.lockTab || '') as InvCategory | '';
      const tab: InvCategory =
        lock === 'food' || lock === 'prop' ? lock : this.data.tab;
      const items = await fetchOwned(lock || tab);
      this.setData({ tab, items });
    },

    async onTapTab(e: WechatMiniprogram.TouchEvent) {
      if (this.properties.lockTab) return;
      const tab = e.currentTarget.dataset.tab as InvCategory;
      if (!tab || tab === this.data.tab) return;
      const items = await fetchOwned(tab);
      this.setData({ tab, items });
    },

    onTapItem(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const item = this.data.items.find((i) => i.id === id);
      if (!item) return;
      this.triggerEvent('select', { item });
    },
  },
});
