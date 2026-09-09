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
    loading: false,
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

  _refreshSeq: 0,

  methods: {
    onStop() {},

    onClose() {
      this.triggerEvent('close');
    },

    async refresh() {
      // 部分编译链不会初始化 options 里的自定义字段，这里自兜底，避免 ++undefined → NaN 把结果全部误判过期
      const seq = (this._refreshSeq = (this._refreshSeq || 0) + 1);
      const lock = (this.properties.lockTab || '') as InvCategory | '';
      const tab: InvCategory =
        lock === 'food' || lock === 'prop' ? lock : this.data.tab;
      // 清空旧列表，避免上一次打开时的内容残留
      this.setData({ loading: true, tab, items: [] });
      console.warn('[inv-picker] refresh start', seq, 'lock=', lock || '(none)');
      try {
        const items = await fetchOwned(lock || tab);
        console.warn('[inv-picker] fetch resolved', seq, 'count=', items.length);
        if (seq !== this._refreshSeq) return; // 已有更新的请求，丢弃过期结果
        this.setData({ tab, items });
      } catch (e) {
        console.warn('[inv-picker] fetch rejected', seq, e);
      } finally {
        if (seq === this._refreshSeq) {
          this.setData({ loading: false });
        }
      }
    },

    async onTapTab(e: WechatMiniprogram.TouchEvent) {
      if (this.properties.lockTab) return;
      const tab = e.currentTarget.dataset.tab as InvCategory;
      if (!tab || tab === this.data.tab) return;
      const seq = ++this._refreshSeq;
      // 先切 tab 贴图（立即反馈），再异步拉列表
      this.setData({ tab, items: [], loading: true });
      try {
        const items = await fetchOwned(tab);
        if (seq !== this._refreshSeq) return;
        this.setData({ items });
      } catch {
        /* ignore: 列表为空就是失败提示 */
      } finally {
        if (seq === this._refreshSeq) {
          this.setData({ loading: false });
        }
      }
    },

    onTapItem(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const item = this.data.items.find((i) => i.id === id);
      if (!item) return;
      this.triggerEvent('select', { item });
    },
  },
});
