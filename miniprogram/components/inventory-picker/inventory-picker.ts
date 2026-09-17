import {
  fetchOwned,
  type InvCategory,
  type InvItemView,
} from '../../services/inventory';
import { COMMON_ASSETS, INVENTORY_ASSETS, assetCdnBase } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  measureGuideHost,
  notifyGuideBlocked,
  type GuideHostCtx,
} from '../../utils/guide-page';
import type { GuideHole } from '../guide-overlay/guide-overlay';

/** 加载动画：四只变装米子从左往右依次亮起再消失（复用 loading/mi-skins，纯 CSS 逐帧控制明暗） */
const LOADING_CATS = ['mi-1', 'mi-2', 'mi-3', 'mi-4'].map((n) =>
  assetCdnBase(`loading/mi-skins/${n}`),
);

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
    /** 加载动画的四只小猫 CDN 地址 */
    loadingCats: LOADING_CATS,
    /** 新手指引遮罩（picker-food / picker-prop 步） */
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
    visible(v: boolean) {
      if (v) {
        this.refresh();
      }
      this.refreshGuide();
    },
    lockTab() {
      if (this.properties.visible) this.refresh();
    },
  },

  _refreshSeq: 0,

  methods: {
    onStop() {},

    onClose() {
      // 指引中选择器不可关闭，必须选中第一件物品
      if (guide.isActive()) return;
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
      try {
        const items = await fetchOwned(lock || tab);
        if (seq !== this._refreshSeq) return; // 已有更新的请求，丢弃过期结果
        this.setData({ tab, items });
        // 指引：列表渲染后重测第一件物品的开孔
        if (guide.isHost('inventory-picker')) {
          wx.nextTick(() => {
            void measureGuideHost('inventory-picker', this as unknown as GuideHostCtx);
          });
        }
      } catch (e) {
        // 网络错误时静默降级为空列表，由用户重试
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
      const index = this.data.items.findIndex((i: InvItemView) => i.id === id);
      if (index < 0) return;
      // 指引 picker 步：仅第一件物品可点
      if (guide.isHost('inventory-picker') && index !== 0) return;
      const item = this.data.items[index];
      this.triggerEvent('select', { item });
    },

    /** 新手指引：选择器可见且处于 inventory-picker 宿主步骤时显示遮罩 */
    refreshGuide() {
      const guideActive = guide.isActive();
      this.setData({ guideActive });
      if (!this.data.visible || !guide.isHost('inventory-picker')) {
        if (this.data.guideVisible) this.setData({ guideVisible: false });
        return;
      }
      refreshGuideHost('inventory-picker', this as unknown as GuideHostCtx);
    },

    onGuideBlocked() {
      notifyGuideBlocked(this as unknown as GuideHostCtx);
    },
  },
});
