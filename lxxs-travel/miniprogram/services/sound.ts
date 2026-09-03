import {
  getAudioPrefs,
  initAudioPrefs,
  isMusicEnabled,
  isSfxEnabled,
  setMusicEnabled,
  setSfxEnabled,
  toggleMusic,
  toggleSfx,
} from './audio-prefs';

const SFX = {
  tap: '/assets/sfx/tap.aac',
} as const;

type SfxKey = keyof typeof SFX;

function play(key: SfxKey) {
  if (!isSfxEnabled() || !wx.createInnerAudioContext) return;
  try {
    const ctx = wx.createInnerAudioContext();
    ctx.src = SFX[key];
    ctx.volume = 0.8;
    ctx.play();
    ctx.onError(() => ctx.destroy());
    ctx.onEnded(() => ctx.destroy());
  } catch {
    /* 资源未就绪时静默 */
  }
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
