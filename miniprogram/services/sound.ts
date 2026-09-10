import { CDN_BASE } from '../config/cloud';
import {
  getAudioPrefs,
  initAudioPrefs,
  isMusicEnabled,
  isSfxEnabled,
  playBgm,
  preloadBgm,
  resumeBgm,
  setMusicEnabled,
  setSfxEnabled,
  toggleMusic,
  toggleSfx,
} from './audio-prefs';

const SFX = {
  /** 通用按钮点击 */
  tap: `${CDN_BASE}/content/ui/sfx/tap.mp3`,
  /** 屋顶拾取星星 */
  star: `${CDN_BASE}/content/ui/sfx/star.mp3`,
  /** 打开日记本 */
  diary_open: `${CDN_BASE}/content/ui/sfx/diary_open.mp3`,
  /** 日记翻页 */
  diary_flip: `${CDN_BASE}/content/ui/sfx/diary_flip.mp3`,
  /** 打开展示柜 */
  showcase_open: `${CDN_BASE}/content/ui/sfx/showcase_open.mp3`,
  /** 小屋翻窗上屋顶 */
  window: `${CDN_BASE}/content/ui/sfx/window.mp3`,
  /** 鸽子飞走 */
  pigeon_fly: `${CDN_BASE}/content/ui/sfx/pigeon_fly.m4a`,
  /** 扭蛋投币 */
  gacha_coin: `${CDN_BASE}/content/ui/sfx/gacha_coin.mp3`,
  /** 扭蛋出结果 */
  gacha_result: `${CDN_BASE}/content/ui/sfx/gacha_result.mp3`,
  /** 扭蛋掉落 */
  gacha_drop: `${CDN_BASE}/content/ui/sfx/gacha_drop.mp3`,
} as const;

type SfxKey = keyof typeof SFX;

/** 音效本地持久化路径表（saveFile 跨会话有效，播放时优先走本地，无本地回落 CDN）。
 *  换音源时 bump 版本号，避免旧本地文件挡住新文件下载 */
const SFX_LOCAL_KEY = 'lxxs_sfx_local_v2';

function readLocalMap(): Record<string, string> {
  try {
    return (wx.getStorageSync(SFX_LOCAL_KEY) as Record<string, string>) || {};
  } catch {
    return {};
  }
}

function writeLocalMap(map: Record<string, string>) {
  try {
    wx.setStorageSync(SFX_LOCAL_KEY, map);
  } catch {
    /* ignore */
  }
}

function fileExists(path: string): boolean {
  if (!path) return false;
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/** 播放用地址：本地已缓存用本地路径，否则 CDN 直链 */
function resolveSrc(key: SfxKey): string {
  const local = readLocalMap()[key];
  return local && fileExists(local) ? local : SFX[key];
}

/** 预载全部音效到本地持久化存储；单文件失败自动回落 CDN，不抛错 */
export async function preloadSfx(): Promise<void> {
  const map = readLocalMap();
  const missing = (Object.keys(SFX) as SfxKey[]).filter((k) => !fileExists(map[k]));
  await Promise.all(
    missing.map(async (key) => {
      try {
        const res = await new Promise<{ statusCode: number; tempFilePath: string }>(
          (resolve, reject) => {
            wx.downloadFile({ url: SFX[key], success: resolve, fail: reject });
          },
        );
        if (res.statusCode !== 200) return;
        const saved = await new Promise<string>((resolve, reject) => {
          wx.getFileSystemManager().saveFile({
            tempFilePath: res.tempFilePath,
            success: (r) => resolve(r.savedFilePath),
            fail: reject,
          });
        });
        map[key] = saved;
        writeLocalMap(map);
      } catch {
        /* 该音效回落 CDN 播放 */
      }
    }),
  );
}

/** 同 key 连点节流间隔，避免快速连点产生爆音/重复叠放 */
const SFX_THROTTLE_MS = 250;
const lastPlayAt: Partial<Record<SfxKey, number>> = {};

function play(key: SfxKey) {
  if (!isSfxEnabled() || !wx.createInnerAudioContext) return;
  const now = Date.now();
  if (now - (lastPlayAt[key] || 0) < SFX_THROTTLE_MS) return;
  lastPlayAt[key] = now;
  resumeBgm();
  try {
    const ctx = wx.createInnerAudioContext();
    ctx.src = resolveSrc(key);
    ctx.volume = 0.8;
    ctx.play();
    ctx.onError(() => ctx.destroy());
    ctx.onEnded(() => ctx.destroy());
  } catch {
    /* 资源未就绪时静默 */
  }
}

/** 播放任意已配置音效（见 SFX 表） */
function playSfx(key: SfxKey) {
  play(key);
}

function playTap() {
  play('tap');
}

/** @deprecated 使用 setSfxEnabled */
function setEnabled(on: boolean) {
  setSfxEnabled(on);
}

/** @deprecated 使用 isSfxEnabled */
function isEnabled() {
  return isSfxEnabled();
}

export {
  playTap,
  playSfx,
  playBgm,
  preloadBgm,
  setEnabled,
  isEnabled,
  SFX,
  initAudioPrefs,
  getAudioPrefs,
  isMusicEnabled,
  isSfxEnabled,
  setMusicEnabled,
  setSfxEnabled,
  toggleMusic,
  toggleSfx,
};
