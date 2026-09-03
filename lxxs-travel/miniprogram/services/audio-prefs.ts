/** 音乐 / 音效开关与音量偏好（本地持久化） */

const STORAGE_KEY = 'lxxs_audio_prefs';

const BGM_SRC = '/assets/sfx/bgm.aac';

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

function ensureBgm() {
  if (!wx.createInnerAudioContext) return null;
  if (!bgm) {
    bgm = wx.createInnerAudioContext();
    bgm.src = BGM_SRC;
    bgm.loop = true;
    bgm.volume = prefs.musicVolume;
    bgm.onError(() => {
      /* 资源未就绪时静默 */
    });
  }
  return bgm;
}

function applyBgmPlayback() {
  const ctx = ensureBgm();
  if (!ctx) return;
  ctx.volume = prefs.musicVolume;
  if (!prefs.musicEnabled) {
    ctx.pause();
    return;
  }
  try {
    ctx.play();
  } catch {
    /* ignore */
  }
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
