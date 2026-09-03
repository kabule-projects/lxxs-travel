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
    lockLabel: '美食',
    items: [] as InvItemView[],
    panelBg: '',
    iconClose: '',
  },

  lifetimes: {
    attached() {
      resolveAsset(INVENTORY_ASSETS.panel).then((panelBg) => {
        this.setData({ panelBg });
      });
      resolveAsset(COMMON_ASSETS.iconClose).then((iconClose) => {
        this.setData({ iconClose });
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
      this.setData({
        tab,
        lockLabel: tab === 'food' ? '美食' : '道具',
        items,
      });
    },

    async onTapTab(e: WechatMiniprogram.TouchEvent) {
      if (this.properties.lockTab) return;
      const tab = e.currentTarget.dataset.tab as InvCategory;
      if (!tab) return;
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
