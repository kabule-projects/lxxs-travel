/** 音乐 / 音效开关与音量偏好（本地持久化） */
import { CDN_BASE } from '../config/cloud';

const STORAGE_KEY = 'lxxs_audio_prefs';

/** 各页面背景音乐（云存储 CDN）；loading 页循环版 / 屋顶 / 房间·商店·扭蛋机 */
export type BgmTrack = 'loading' | 'roof' | 'room';

const BGM_SRC: Record<BgmTrack, string> = {
  loading: `${CDN_BASE}/content/ui/bgm/loading.mp3`,
  roof: `${CDN_BASE}/content/ui/bgm/roof.mp3`,
  room: `${CDN_BASE}/content/ui/bgm/room.mp3`,
};

/** BGM 本地持久化路径表（saveFile 跨会话有效，播放时优先走本地，无本地回落 CDN） */
const BGM_LOCAL_KEY = 'lxxs_bgm_local_v1';

export interface AudioPrefs {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
}

const DEFAULT_PREFS: AudioPrefs = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.8,
};

let prefs: AudioPrefs = { ...DEFAULT_PREFS };
let bgm: WechatMiniprogram.InnerAudioContext | null = null;
let currentTrack: BgmTrack = 'loading';
/** 最近一次实际开始播放的音轨（区分“当前应播”与“ctx 正在播”） */
let startedTrack: BgmTrack | null = null;

function readStorage(): AudioPrefs {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY) as Partial<AudioPrefs> | '';
    if (raw && typeof raw === 'object') {
      return {
        musicEnabled: raw.musicEnabled !== false,
        sfxEnabled: raw.sfxEnabled !== false,
        musicVolume:
          typeof raw.musicVolume === 'number'
            ? Math.max(0, Math.min(1, raw.musicVolume))
            : DEFAULT_PREFS.musicVolume,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS };
}

function writeStorage() {
  try {
    wx.setStorageSync(STORAGE_KEY, prefs);
  } catch {
    /* ignore */
  }
}

function readBgmLocalMap(): Record<string, string> {
  try {
    return (wx.getStorageSync(BGM_LOCAL_KEY) as Record<string, string>) || {};
  } catch {
    return {};
  }
}

function writeBgmLocalMap(map: Record<string, string>) {
  try {
    wx.setStorageSync(BGM_LOCAL_KEY, map);
  } catch {
    /* ignore */
  }
}

function bgmFileExists(path: string): boolean {
  if (!path) return false;
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/** 播放用地址：本地已缓存用本地路径，否则 CDN 直链 */
function resolveBgmSrc(track: BgmTrack): string {
  const local = readBgmLocalMap()[track];
  return local && bgmFileExists(local) ? local : BGM_SRC[track];
}

function ensureBgm() {
  if (!wx.createInnerAudioContext) return null;
  if (!bgm) {
    bgm = wx.createInnerAudioContext();
    bgm.loop = true;
    bgm.volume = prefs.musicVolume;
    bgm.onError(() => {
      /* 资源未就绪时静默 */
    });
  }
  return bgm;
}

/** 切换/启动背景音乐；同轨已在播则不动，音乐关闭时只记音轨不切ctx */
export function playBgm(track: BgmTrack) {
  currentTrack = track;
  if (!prefs.musicEnabled || !wx.createInnerAudioContext) return;
  const ctx = ensureBgm();
  if (!ctx) return;
  ctx.volume = prefs.musicVolume;
  if (startedTrack === track && !ctx.paused) return;
  try {
    if (startedTrack !== track) {
      ctx.stop();
      ctx.src = resolveBgmSrc(track);
      startedTrack = track;
    }
    ctx.play();
  } catch {
    /* ignore */
  }
}

/** 真机首次需用户手势才能出声；任意音效播放时顺带唤醒 BGM */
export function resumeBgm() {
  if (!prefs.musicEnabled || !bgm) return;
  if (bgm.paused) {
    try {
      bgm.play();
    } catch {
      /* ignore */
    }
  }
}

/** 预载全部 BGM 到本地持久化存储；单文件失败自动回落 CDN，不抛错 */
export async function preloadBgm(): Promise<void> {
  const map = readBgmLocalMap();
  const missing = (Object.keys(BGM_SRC) as BgmTrack[]).filter(
    (k) => !bgmFileExists(map[k]),
  );
  await Promise.all(
    missing.map(async (track) => {
      try {
        const res = await new Promise<{ statusCode: number; tempFilePath: string }>(
          (resolve, reject) => {
            wx.downloadFile({ url: BGM_SRC[track], success: resolve, fail: reject });
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
        map[track] = saved;
        writeBgmLocalMap(map);
      } catch {
        /* 该曲目回落 CDN 播放 */
      }
    }),
  );
}

function applyBgmPlayback() {
  if (!prefs.musicEnabled) {
    bgm?.pause();
    return;
  }
  playBgm(currentTrack);
}

export function initAudioPrefs() {
  prefs = readStorage();
  applyBgmPlayback();
}

export function getAudioPrefs(): AudioPrefs {
  return { ...prefs };
}

export function setMusicEnabled(on: boolean) {
  prefs.musicEnabled = on;
  writeStorage();
  applyBgmPlayback();
}

export function setSfxEnabled(on: boolean) {
  prefs.sfxEnabled = on;
  writeStorage();
}

export function setMusicVolume(volume: number) {
  prefs.musicVolume = Math.max(0, Math.min(1, volume));
  writeStorage();
  if (bgm) bgm.volume = prefs.musicVolume;
  if (prefs.musicEnabled && prefs.musicVolume <= 0) {
    prefs.musicEnabled = false;
    writeStorage();
    bgm?.pause();
  }
}

export function isMusicEnabled() {
  return prefs.musicEnabled;
}

export function isSfxEnabled() {
  return prefs.sfxEnabled;
}

export function getMusicVolume() {
  return prefs.musicVolume;
}

export function toggleMusic() {
  if (prefs.musicEnabled) {
    setMusicEnabled(false);
    return false;
  }
  if (prefs.musicVolume <= 0) {
    prefs.musicVolume = DEFAULT_PREFS.musicVolume;
  }
  setMusicEnabled(true);
  return true;
}

export function toggleSfx() {
  const next = !prefs.sfxEnabled;
  setSfxEnabled(next);
  return next;
}
