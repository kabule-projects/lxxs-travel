import type { MailItem } from '../../services/postcard';
import { markMailsSeen } from '../../services/postcard';
import { playTap } from '../../services/sound';
import { MAILBOX_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';

function formatMailDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    items: { type: Array, value: [] as MailItem[] },
    mailCap: { type: Number, value: 5 },
  },

  data: {
    listItems: [] as MailItem[],
    detailVisible: false,
    letterVisible: false,
    zoomImage: '',
    zoomTitle: '',
    letterDate: '',
    letterStory: '',
    assets: {
      panel: '',
      rowBg: '',
      iconClose: '',
      envelope: '',
    },
  },

  lifetimes: {
    attached() {
      resolveAssetMap(MAILBOX_ASSETS).then((assets) => {
        this.setData({ assets });
      });
    },
    detached() {
      // 页面销毁兜底：尝试 flush 已读攒批（组件销毁后 promise 仍会把上报发完，不影响结果）
      void this.flushSeen();
    },
  },
  _active: null as MailItem | null,
  /** 已读攒批：读信只记 instanceId，本地立即变已读，云端等关弹窗/detached 时一次批量上报（见 flushSeen） */
  _pendingSeen: null as Set<string> | null,
  /** flush 重入锁：上报进行期间新产生的 pending 留给下一批 */
  _pendingFlush: false as boolean,

  observers: {
    items(list: MailItem[]) {
      this.setData({ listItems: list || [] });
    },
    visible(v: boolean) {
      if (!v) {
        this.resetDetail();
        // 关弹窗即 flush 已读攒批（一次 callFunction 批量上报）
        void this.flushSeen();
      }
    },
  },

  methods: {
    onStop() {},

    onClose() {
      this.resetDetail();
      this.triggerEvent('close');
    },

    /** 已读攒批上报：关弹窗/detached/pending≥5 时调用；失败保留 pending 下次重试 */
    async flushSeen() {
      const pending = this._pendingSeen;
      if (!pending || !pending.size || this._pendingFlush) return;
      this._pendingFlush = true;
      const ids = [...pending];
      try {
        await markMailsSeen(ids);
        ids.forEach((id) => pending.delete(id));
      } catch {
        /* 网络失败：保留 pending，下次 flush 重试；服务端未读计数短暂滞后无影响 */
      } finally {
        this._pendingFlush = false;
      }
    },

    resetDetail() {
      this.setData({
        detailVisible: false,
        letterVisible: false,
        zoomImage: '',
        zoomTitle: '',
        letterDate: '',
        letterStory: '',
      });
      this._active = null;
    },

    /** 缩略图资源实际不存在（404 等）时回退主图；主图同样失败则清空走占位首字 */
    onThumbError(e: WechatMiniprogram.BaseEvent) {
      const index = Number(e.currentTarget.dataset.index);
      const item = (this.data.listItems as MailItem[])[index];
      if (!item || !item.imageThumb) return;
      const full = item.imageFull || '';
      this.setData({
        [`listItems[${index}].imageThumb`]: full !== item.imageThumb ? full : '',
      });
    },

    async onTapRow(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index);
      const item = (this.data.listItems as MailItem[])[index];
      if (!item) return;
      playTap();
      this._active = item;

      let listItems = this.data.listItems as MailItem[];
      if (item.isNew) {
        // 已读攒批：本地立即变已读，云端等 flushSeen（关弹窗/detached/pending≥5）
        if (!this._pendingSeen) this._pendingSeen = new Set();
        this._pendingSeen.add(item.instanceId);
        listItems = listItems.map((m) =>
          m.instanceId === item.instanceId ? { ...m, isNew: false } : m,
        );
        this.setData({ listItems });
        this.triggerEvent('itemschange', { items: listItems });
        if (this._pendingSeen.size >= 5) void this.flushSeen();
      }

      this.setData({
        detailVisible: true,
        letterVisible: false,
        zoomImage: item.imageFull || '',
        zoomTitle: item.title || '明信片的名字',
        letterDate: formatMailDate(item.deliverAt),
        letterStory: item.story || '',
      });
    },

    onCloseDetail() {
      this.setData({
        detailVisible: false,
        letterVisible: false,
      });
      this._active = null;
    },

    onTapEnvelope() {
      playTap();
      this.setData({ letterVisible: true });
    },

    onCloseLetter() {
      this.setData({ letterVisible: false });
    },

    /** 展开信件时自动收下：保持阅读态，仅从列表移除并通知父级 */
    onClaim() {
      const item = this._active as MailItem | null;
      if (!item) return;
      const listItems = (this.data.listItems as MailItem[]).filter(
        (m) => m.instanceId !== item.instanceId,
      );
      this.setData({ listItems });
      this.triggerEvent('itemschange', { items: listItems });
      this.triggerEvent('claim', { item });
    },
  },
});
