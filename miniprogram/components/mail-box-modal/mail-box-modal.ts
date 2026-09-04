import type { MailItem } from '../../services/postcard';
import { markMailSeen } from '../../services/postcard';
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
  },
  _active: null as MailItem | null,

  observers: {
    items(list: MailItem[]) {
      this.setData({ listItems: list || [] });
    },
    visible(v: boolean) {
      if (!v) {
        this.resetDetail();
      }
    },
  },

  methods: {
    onStop() {},

    onClose() {
      this.resetDetail();
      this.triggerEvent('close');
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

    async onTapRow(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index);
      const item = (this.data.listItems as MailItem[])[index];
      if (!item) return;
      playTap();
      this._active = item;

      let listItems = this.data.listItems as MailItem[];
      if (item.isNew) {
        try {
          await markMailSeen(item.tripId, item.instanceId);
        } catch {
          /* ignore */
        }
        listItems = listItems.map((m) =>
          m.instanceId === item.instanceId ? { ...m, isNew: false } : m,
        );
        this.setData({ listItems });
        this.triggerEvent('itemschange', { items: listItems });
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
