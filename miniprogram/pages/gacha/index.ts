import { GACHA_ASSETS } from '../../utils/asset-path';
import { resolveAssetMap } from '../../utils/resolve-assets';
import { resolvePersistentImage } from '../../utils/image-cache';
import { readSafeArea, readCapsuleRect } from '../../utils/device';
import { bindStageFit, getFit } from '../../utils/fit';
import { playSfx, playTap, playBgm } from '../../services/sound';
import { navigateBack } from '../../utils/nav';
import { getStars, getRiceStars, setStars } from '../../store/user';
import { GameEvent, on } from '../../utils/event-bus';
import {
  drawGacha,
  gachaCost,
  listGachaCatalog,
  type GachaCatalogItem,
  type GachaDrawItem,
  type GachaDrawResult,
} from '../../services/gacha';
import * as guide from '../../services/guide';
import {
  refreshGuideHost,
  notifyGuideBlocked,
  setGuideBackGuard,
} from '../../utils/guide-page';
import type { GuideHole } from '../../components/guide-overlay/guide-overlay';

type GachaAssets = Record<keyof typeof GACHA_ASSETS, string>;

/** 抽扭蛋动图时长（ms）：需与 get_one / get_five 动图实际播放时长一致，到点衔接结果弹窗。
 * 素材实测 72 帧共 9.44s——之前配 6000 会在动画中途硬切，造成"每次都没播完/下次接着播"的重复感 */
const ANIM_MS: Record<1 | 5, number> = { 1: 9400, 5: 9400 };

/** 动画首帧重播：把本地文件复制成唯一新路径，迫使解码缓存 miss（替代旧的 URL 加时间戳方案——
 *  时间戳会击穿客户端缓存，导致每次抽取都重复下载 3.5MB+，是 CDN 流量头号来源）。
 *  副本只写在本地磁盘，自动保留最近 3 份；复制失败回落原路径（行为同旧时间戳方案的降级）。 */
const ANIM_COPY_DIR = `${(wx as any).env.USER_DATA_PATH}/gacha-anim`;
function makeReplayCopy(localSrc: string): string {
  try {
    // 项目 wx 类型版本较旧，未声明 env/copyFileSync 等运行时已有的 API，这里放宽取值
    const fs = wx.getFileSystemManager() as any;
    try {
      fs.accessSync(ANIM_COPY_DIR);
    } catch {
      fs.mkdirSync(ANIM_COPY_DIR, true);
    }
    const name = `anim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.webp`;
    fs.copyFileSync(localSrc, `${ANIM_COPY_DIR}/${name}`);
    const files = fs.readdirSync(ANIM_COPY_DIR).sort();
    while (files.length > 3) {
      const old = files.shift();
      if (old) {
        try {
          fs.unlinkSync(`${ANIM_COPY_DIR}/${old}`);
        } catch {
          /* 清理失败不阻断 */
        }
      }
    }
    return `${ANIM_COPY_DIR}/${name}`;
  } catch {
    return localSrc;
  }
}

Page({
  data: {
    /** 顶栏 top：胶囊底边 + 12px，避让右上角胶囊（同 home） */
    hudTop: 0,
    /** 底栏 bottom：安全区上沿 + 8px */
    footBottom: 0,
    assets: {} as GachaAssets,
    /** 抽奖动图地址：抽奖时设置；静态图常驻不切 src */
    animSrc: '',
    /** 动图是否已加载完成：加载好后才隐藏静态图，避免空档 */
    animReady: false,
    stars: 0,
    riceStars: 0,
    /** 设计舞台内联样式（短宽屏缩放；见 utils/fit.ts） */
    stageStyle: '',
    spinning: false,
    showResult: false,
    showPrizes: false,
    drawResults: [] as GachaDrawItem[],
    catalog: [] as GachaCatalogItem[],
    showSettings: false,
    /** 新手指引遮罩 */
    guideVisible: false,
    guideHoles: [] as GuideHole[],
    guideHit: null as { x: number; y: number; w: number; h: number } | null,
    guideText: '',
  },

  _spinTimer: 0 as number,
  /** 动画实际播放计时器：bindload（动图就绪）后才启动，保证抽1/抽5都完整播完 */
  _animTimer: 0 as number,
  _drawing: false,
  /** 出发同步锁：onTapDraw 用内存标记防连点——setData 是异步的，快速点两下时
   *  两次 onTapDraw 都会读到 data.spinning=false，导致动画/请求被重复触发 */
  _drawLock: false,
  /** 当前抽奖次数（动画时长按次数取） */
  _spinCount: 0 as 0 | 1 | 5,
  /** 本次抽奖的进行中 Promise（与动图并行发起，动图播完/跳过时 await 它） */
  _drawPromise: null as Promise<GachaDrawResult> | null,
  _offStars: null as (() => void) | null,
  _offGuide: null as (() => void) | null,
  _guideStep: '' as string,
  _guideTimer: 0 as number,
  _guideBlockedAt: 0 as number,

  onLoad() {
    bindStageFit(this);
    const safe = readSafeArea();
    const capsule = readCapsuleRect();
    const fit = getFit();
    this.setData({
      stageStyle: fit.stageStyle,
      // 顶栏/底栏按屏幕 px 锚定，换算到舞台坐标（短宽屏整体缩小时仍贴胶囊与安全区）
      hudTop: fit.toStageY(capsule.bottom + 12),
      footBottom: fit.toStageY(Math.max(safe.bottom, 16) + 8),
    });
    this.syncWallet();
    this.loadAssets();
    this.reloadCatalog();
    this._offStars = on(GameEvent.STARS_UPDATED, () => {
      this.syncWallet();
    });
    this._offGuide = guide.onChange(() => {
      this.refreshGuide();
    });
  },

  onShow() {
    playBgm('room');
    this.syncWallet();
    // 从商店进入：商店放行扭蛋后承接为单抽步骤
    if (guide.isStep('shop-to-gacha')) guide.advance('gacha-draw');
    // 自愈：结果确认步却回到扭蛋页（如系统返回后页面重建，结果弹窗已不存在）→ 退回单抽步重来
    if (guide.isStep('gacha-result') && !this.data.showResult) {
      guide.advance('gacha-draw');
    }
    this.refreshGuide();
  },

  onUnload() {
    if (this._spinTimer) clearTimeout(this._spinTimer);
    if (this._animTimer) clearTimeout(this._animTimer);
    this._offStars?.();
    this._offGuide?.();
    if (this._guideTimer) clearTimeout(this._guideTimer);
    setGuideBackGuard(false);
  },

  syncWallet() {
    this.setData({
      stars: getStars(),
      riceStars: getRiceStars(),
    });
  },

  async loadAssets() {
    const assets = await resolveAssetMap(GACHA_ASSETS);
    this.setData({ assets });
    // 预载抽奖动图到【本地持久化缓存】（旧 getImageInfo 每次进页整图下载且不留存，
    // 两台动画 7MB+ 每次访问都重复消耗 CDN；本地化后每台设备终身只下载一次）
    [assets.machineOne, assets.machineFive].forEach((src) => {
      void resolvePersistentImage(src);
    });
  },

  /** 动图首帧加载完成：显示动图并启动播放计时（每次 src 带时间戳，必从首帧起播） */
  onAnimLoad() {
    if (!this.data.spinning || this.data.animReady) return;
    this.setData({ animReady: true });
    const count = this._spinCount === 5 ? 5 : 1;
    this._animTimer = setTimeout(() => {
      this.finishSpin();
    }, ANIM_MS[count]) as unknown as number;
  },

  async reloadCatalog() {
    try {
      const catalog = await listGachaCatalog();
      this.setData({ catalog });
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '扭蛋机加载失败',
        icon: 'none',
      });
    }
  },

  onTapBack() {
    if (guide.isActive()) return;
    playTap();
    navigateBack('/pages/shop/index');
  },

  onTapSettings() {
    if (guide.isActive()) return;
    playTap();
    this.setData({ showSettings: true });
  },

  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  onTapDraw(e: WechatMiniprogram.TouchEvent) {
    if (this.data.spinning || this.data.showResult || this._drawLock) return;
    const count = Number(e.currentTarget.dataset.count) as 1 | 5;
    if (count !== 1 && count !== 5) return;
    // 指引单抽步：五连拒绝
    if (guide.isActive() && !(guide.isStep('gacha-draw') && count === 1)) return;
    playSfx('gacha_coin');
    const { stars } = this.data;
    const cost = gachaCost(count);
    if (stars < cost) {
      wx.showToast({
        title: count > 1 ? '星星不足，无法五连' : '星星不足',
        icon: 'none',
      });
      return;
    }
    // 先抢同步锁再出发，杜绝 setData 异步窗口内的双击重复触发
    this._drawLock = true;
    this.startSpin(count);
  },

  onTapSkipSpin() {
    if (!this.data.spinning) return;
    // 跳过动画：立即收尾（若抽奖请求未返回则等它返回，结果不丢）
    this.finishSpin();
  },

  startSpin(count: 1 | 5) {
    const { assets } = this.data;
    // 防御：清理可能残留的上一轮计时器（双击竞态等极端路径），避免多个计时器连环收尾
    if (this._spinTimer) clearTimeout(this._spinTimer);
    if (this._animTimer) clearTimeout(this._animTimer);
    this._spinTimer = 0;
    this._animTimer = 0;
    playSfx('gacha_drop');
    this._drawPromise = drawGacha(count);
    this._spinCount = count;
    // 动图本地化：首次抽取下载并持久化（之后零 CDN 流量）；
    // 每次抽取复制唯一本地副本实现首帧重播（解码缓存按路径缓存，新路径必从第一帧播）
    const baseSrc = count === 5 ? assets.machineFive : assets.machineOne;
    this.setData({ spinning: true, animReady: false, animSrc: '' });
    void resolvePersistentImage(baseSrc).then((local) => {
      if (!this.data.spinning) return; // 解析期间已跳过/收尾则丢弃
      this.setData({ animSrc: makeReplayCopy(local) });
    });
    // 兜底：动图加载失败/超慢时也不卡死，最多 ANIM_MS+5s 后收尾
    this._spinTimer = setTimeout(() => {
      this.finishSpin();
    }, ANIM_MS[count] + 5000) as unknown as number;
  },

  async finishSpin() {
    if (this._drawing || !this._drawPromise) return;
    this._drawing = true;
    if (this._spinTimer) clearTimeout(this._spinTimer);
    if (this._animTimer) clearTimeout(this._animTimer);
    this._spinTimer = 0;
    this._animTimer = 0;
    // 动画播完/跳过：立即移除动图层切回静态图，避免在 await 抽奖结果期间动图继续循环多播
    this.setData({ spinning: false, animReady: false, animSrc: '' });
    try {
      const res = await this._drawPromise;
      setStars(res.stars);
      // 指引：先推进到结果确认步（页面遮罩隐藏，结果弹窗内部遮罩接管），再展示弹窗
      if (guide.isStep('gacha-draw')) guide.advance('gacha-result');
      playSfx('gacha_result');
      this.setData({
        stars: res.stars,
        drawResults: res.results,
        showResult: true,
      });
      this.reloadCatalog();
    } catch (e) {
      wx.showToast({
        title: (e as Error).message || '抽取失败',
        icon: 'none',
      });
    } finally {
      this._drawing = false;
      this._drawPromise = null;
      this._drawLock = false;
    }
  },

  onCloseResult() {
    if (guide.isActive()) return;
    this.setData({ showResult: false, drawResults: [] });
  },

  onConfirmResult() {
    playTap();
    this.setData({ showResult: false, drawResults: [] });
    // 指引确认奖品：回 home 继续背包教学
    if (guide.isStep('gacha-result')) {
      setGuideBackGuard(false);
      guide.advance('home-bag');
      wx.reLaunch({ url: '/pages/home/index' });
    }
  },

  async onTapPrizes() {
    if (guide.isActive()) return;
    playTap();
    await this.reloadCatalog();
    this.setData({ showPrizes: true });
  },

  onClosePrizes() {
    this.setData({ showPrizes: false });
  },

  /** 新手指引：gacha-draw 步由页面遮罩负责，gacha-result 步交给结果弹窗内部遮罩 */
  refreshGuide() {
    if (guide.isStep('gacha-result')) {
      if (this.data.guideVisible) this.setData({ guideVisible: false });
      // 结果步仍需拦截系统返回（弹窗组件内遮罩不负责页面返回）
      setGuideBackGuard(true);
      return;
    }
    refreshGuideHost('gacha', this);
    setGuideBackGuard(guide.isHost('gacha'));
  },

  onGuideBlocked() {
    notifyGuideBlocked(this);
  },
});
