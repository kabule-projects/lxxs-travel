import { MEMO_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { readCapsuleRect } from '../../utils/device';
import { playTap } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { getMemo, saveMemo } from '../../services/memo';
import { toastCloudError } from '../../utils/net-error';

type MemoAssets = Record<keyof typeof MEMO_ASSETS, string>;

/** 与云端 game_config memo.maxLength 默认值一致；云端仍有最终校验 */
const MAX_LENGTH = 2000;
/** 输入停止后自动保存的防抖间隔 */
const SAVE_DEBOUNCE_MS = 1500;

/** 本地业务日 YYYY-MM-DD（UTC+8 日切，与云端 common/game.businessDayKey 同口径） */
function businessDayKeyLocal(ts = Date.now()): string {
  const d = new Date(ts + 8 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

Page({
  data: {
    assets: {} as MemoAssets,
    dateKey: '',
    content: '',
    maxLength: MAX_LENGTH,
    panelW: 0,
    panelH: 0,
    backTop: 120,
  },

  _dirty: false,
  _saving: false,
  _saveTimer: 0 as number,
  /** 当前编辑的记录 id；新建保存成功后由云端返回补上，后续自动保存走编辑路径 */
  _memoId: undefined as string | undefined,

  onLoad(options?: { id?: string }) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.screenWidth || info.windowWidth || 375;
    const screenH = info.screenHeight || info.windowHeight || 667;
    const capsule = readCapsuleRect();
    // 面板按屏高定尺寸（mockup 占高约 83%），超宽机型回退按屏宽 90% 限制
    let panelH = screenH * 0.83;
    let panelW = panelH * (1258 / 2450);
    const maxW = screenW * 0.9;
    if (panelW > maxW) {
      panelW = maxW;
      panelH = panelW * (2450 / 1258);
    }
    const id = options?.id;
    this._memoId = id || undefined;
    this.setData({
      panelW,
      panelH,
      backTop: (capsule.bottom || 88) + 12,
      // 新建模式先显示今天（UTC+8 业务日），保存后以云端返回为准
      dateKey: id ? '' : businessDayKeyLocal(),
    });
    resolveAssetMap(MEMO_ASSETS).then((assets) => {
      this.setData({ assets });
    });
    if (id) void this.load(id);
  },

  onUnload() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
  },

  /** 拉取既有记录（按 id） */
  async load(id: string) {
    try {
      const res = await getMemo(id);
      this.setData({ dateKey: res.memo.dateKey, content: res.memo.content || '' });
      this._dirty = false;
    } catch {
      toastCloudError('memo-get', '网络异常，记录加载失败');
    }
  },

  onInput(e: { detail?: { value?: string } }) {
    this.setData({ content: e.detail?.value || '' });
    this._dirty = true;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      void this.save();
    }, SAVE_DEBOUNCE_MS) as unknown as number;
  },

  /** 有改动才存；空内容不存（后端也拒绝空）。首次记录自动发奖并提示 */
  async save(): Promise<void> {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = 0;
    }
    if (!this._dirty || this._saving) return;
    const content = this.data.content;
    if (!content.trim()) return;
    this._saving = true;
    try {
      const res = await saveMemo(content, this._memoId);
      this._dirty = false;
      // 新建首次保存成功后拿到 id，之后的自动保存走编辑路径，不会重复建条
      this._memoId = res.memo.id;
      this.setData({ dateKey: res.memo.dateKey });
      if (res.reward?.grantedNow) {
        wx.showToast({
          title: res.reward.rice > 0 ? `获得 ${res.reward.stars} 星和 ${res.reward.rice} 米子星！` : `获得 ${res.reward.stars} 颗星星！`,
          icon: 'none',
        });
      }
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      if (code === 'TOO_LONG') {
        wx.showToast({ title: '内容太长了', icon: 'none' });
      } else {
        toastCloudError('memo-save', '网络异常，保存失败');
      }
    } finally {
      this._saving = false;
    }
  },

  async onTapBack() {
    playTap();
    await this.save();
    navigateBack('/pages/memo/index');
  },
});
