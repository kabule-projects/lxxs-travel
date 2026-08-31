import { readDevice } from './device';
import GAME from './constants';

export type AssetDpr = '2x' | '3x';

/** 全项目通用 icon */
export const COMMON_ASSETS = {
  iconClose: 'icons/common/close',
  iconClear: 'icons/common/clear',
  iconStar: 'icons/home/star',
  iconSettingsGrid: 'icons/common/settings-grid',
  thumbPlaceholder: 'icons/common/thumb-placeholder',
} as const;

export const ROOF_SCENE_ASSETS = {
  sky: 'shared/roof/sky',
  rooftop: 'shared/roof/rooftop',
} as const;

export const ROOF_ASSETS = {
  star: 'roof/star',
  starRice: 'roof/star-rice',
  magicHat: 'roof/magic-hat',
  pigeon: 'roof/pigeon',
  pigeonMail: 'roof/pigeon-mail',
  mailTip: 'roof/mail-tip',
  btnPrepare: 'home/btn-prepare',
  iconStar: 'icons/home/star',
  iconRiceStar: 'roof/star-rice',
  iconItems: 'icons/roof/items',
  iconShop: 'icons/home/shop',
  iconHome: 'icons/roof/home',
  iconPrepare: 'icons/home/prepare',
  iconGrid: 'icons/common/settings-grid',
} as const;

export const HOME_ASSETS = {
  /** 整页静态背景（家具/角色/装饰合一） */
  room: 'home/room',
  btnPrepare: 'home/btn-prepare',
  iconStar: 'icons/home/star',
  iconRiceStar: 'roof/star-rice',
  iconBag: 'icons/home/bag',
  iconShop: 'icons/home/shop',
  iconGacha: 'icons/shop/utility-gacha',
  iconPrepare: 'icons/home/prepare',
  iconGrid: 'icons/common/settings-grid',
} as const;

export const SHOP_ASSETS = {
  /** 整页静态背景（条纹/店主/柜台框/木纹/信纸装饰等合一） */
  pageBg: 'shop/page-bg',
  iconBack: 'icons/shop/back',
  iconStar: 'icons/home/star',
  iconRiceStar: 'roof/star-rice',
  iconGacha: 'icons/shop/utility-gacha',
  iconGrid: 'icons/common/settings-grid',
  priceTag: 'shop/price-tag',
  btnBuy: 'shop/btn-buy',
  btnBuyDisabled: 'shop/btn-buy-disabled',
  sideBtnBag: 'shop/side-btn-bag',
  sideBtnStar: 'shop/side-btn-star',
} as const;

export const GACHA_ASSETS = {
  iconBack: 'icons/shop/back',
  iconStar: 'icons/home/star',
  iconGrid: 'icons/common/settings-grid',
  machine: 'gacha/machine',
  rug: 'gacha/rug',
  btnSpin: 'gacha/btn-spin',
  btnDraw1: 'gacha/btn-draw-1',
  btnDraw5: 'gacha/btn-draw-5',
  btnPrizes: 'gacha/btn-prizes',
  exchangeBanner: 'gacha/exchange-banner',
  resultPanel: 'gacha/result-panel',
  btnConfirm: 'gacha/btn-confirm',
  catalogPanel: 'gacha/catalog-panel',
  prizeLocked: 'icons/gacha/prize-locked',
} as const;

export const SHOWCASE_ASSETS = {
  iconBack: 'icons/shop/back',
  iconGrid: 'icons/common/settings-grid',
  cabinet: 'showcase/cabinet',
  shelfBoard: 'showcase/shelf-board',
  detailPanel: 'showcase/detail-panel',
} as const;

export const DIARY_ASSETS = {
  iconBack: 'icons/shop/back',
  iconGrid: 'icons/common/settings-grid',
  frame: 'diary/frame',
  notebook: 'diary/notebook',
  spine: 'diary/spine',
  tab: 'diary/tab',
  tabActive: 'diary/tab-active',
  weatherSun: 'icons/diary/weather-sun',
  weatherCloud: 'icons/diary/weather-cloud',
  weatherRain: 'icons/diary/weather-rain',
  mascot: 'diary/mascot',
  envelope: 'icons/diary/envelope',
  envelopeBadge: 'icons/diary/envelope-badge',
} as const;

export const LETTER_ASSETS = {
  dateLabel: 'diary/letter-date-label',
  weatherSun: 'icons/diary/letter-weather-sun',
  weatherSunset: 'icons/diary/letter-weather-sunset',
  paper: 'diary/letter-paper',
  logo: 'diary/letter-logo',
  btnClaim: 'diary/letter-btn-claim',
} as const;

export const MAILBOX_ASSETS = {
  panel: 'mailbox/panel',
  title: 'mailbox/title',
  iconClose: 'mailbox/icon-close',
  deco: 'mailbox/deco',
  envelope: 'icons/diary/envelope',
  envelopeBadge: 'icons/diary/envelope-badge',
} as const;

export const BAG_ASSETS = {
  panel: 'bag/panel',
  slotFood: 'bag/slot-food',
  slotRice: 'bag/slot-rice',
  slotProp: 'bag/slot-prop',
  labelFood: 'bag/label-food',
  labelRice: 'bag/label-rice',
  labelProp: 'bag/label-prop',
  goBubble: 'bag/go-bubble',
  btnDepart: 'bag/btn-depart',
} as const;

export const INVENTORY_ASSETS = {
  panel: 'inventory/panel',
} as const;

export const DEPART_ASSETS = {
  panel: 'depart/panel',
  btnWait: 'depart/btn-wait',
  btnConfirm: 'depart/btn-confirm',
} as const;

export const TRIP_ASSETS = {
  banner: 'shared/trip-banner',
} as const;

export const PROFILE_ASSETS = {
  panel: 'profile/panel',
  avatarPlaceholder: 'profile/avatar-placeholder',
  btnSubmit: 'profile/btn-submit',
} as const;

export const WARDROBE_ASSETS = {
  iconBack: 'icons/shop/back',
  iconGrid: 'icons/common/settings-grid',
  empty: 'wardrobe/empty',
} as const;

/** 宅家四姿势，各一张 WebP */
export const SETTINGS_ASSETS = {
  panel: 'settings/panel',
  title: 'settings/title',
  toggleOn: 'settings/toggle-on',
  toggleOff: 'settings/toggle-off',
  userIdBar: 'settings/user-id-bar',
} as const;

export const HOME_IDLE_ASSETS: Record<(typeof GAME.IDLE_POSES)[number], string> = {
  bed: 'home/shenshen-bed',
  table: 'home/shenshen-table',
  window: 'home/shenshen-window',
  desk: 'home/shenshen-desk',
};

export const LOADING_ASSETS = {
  btnEnter: 'loading/btn-enter',
  btnEnterDisabled: 'loading/btn-enter-disabled',
  barTrack: 'loading/bar-track',
  barFill: 'loading/bar-fill',
  barThumb: 'loading/bar-thumb',
} as const;

export const DESIGN = {
  logicW: GAME.DESIGN_LOGIC_W,
  logicH: GAME.DESIGN_LOGIC_H,
};

export function pickAssetDpr(): AssetDpr {
  const { pixelRatio } = readDevice();
  return pixelRatio >= 2.75 ? '3x' : '2x';
}

export function assetWebp(relativeWithoutExt: string): string {
  const dpr = pickAssetDpr();
  return `/assets/${relativeWithoutExt}@${dpr}.webp`;
}

export function assetWebpCandidates(relativeWithoutExt: string): string[] {
  const preferred = pickAssetDpr();
  const order: AssetDpr[] =
    preferred === '3x' ? ['3x', '2x'] : ['2x', '3x'];
  const paths = order.map((d) => `/assets/${relativeWithoutExt}@${d}.webp`);
  paths.push(`/assets/${relativeWithoutExt}.webp`);
  return [...new Set(paths)];
}

export function preloadFirstAvailable(candidates: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        reject(new Error('all assets failed'));
        return;
      }
      const src = candidates[i++];
      wx.getImageInfo({
        src,
        success: () => resolve(src),
        fail: tryNext,
      });
    };
    tryNext();
  });
}
