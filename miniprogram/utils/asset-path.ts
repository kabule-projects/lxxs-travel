import { readDevice } from './device';
import GAME from './constants';

export type AssetDpr = '2x' | '3x';

/** 全项目通用 icon */
export const COMMON_ASSETS = {
  iconClose: 'icons/common/close',
  /** 与关闭同图（槽位清除等） */
  iconClear: 'icons/common/close',
  iconStar: 'icons/home/star',
  iconSettingsGrid: 'icons/common/settings-grid',
  thumbPlaceholder: 'icons/common/thumb-placeholder',
} as const;

export const ROOF_SCENE_ASSETS = {
  /** loading / 屋顶 共用完整背景（原 sky/rooftop 两层合并） */
  bg: 'shared/roof/bg',
} as const;

export const ROOF_ASSETS = {
  /** 顶栏星星计数框（含星星 icon 的整张贴图，数字叠加其上） */
  pillStar: 'roof/pill-star',
  /** 顶栏米字星计数框（含米字星 icon 的整张贴图） */
  pillRice: 'roof/pill-rice',
  star: 'roof/star',
  starRice: 'roof/star-rice',
  /** 星星光晕贴图：垫在星星下层，与 pending 态 CSS 光晕（box-shadow）叠加 */
  starGlow: 'roof/star-glow',
  magicHat: 'roof/magic-hat',
  pigeon: 'roof/pigeon',
  pigeonMail: 'roof/pigeon-mail',
  /** 飞行动图（临时：常驻叠在 pigeon 上供调位置大小，调好后改接 flyAway） */
  pigeonFly: 'roof/pigeon-fly',
  /** 未读提示 NEW（未满） */
  mailTip: 'roof/mail-tip',
  /** 未读已满提示「满」（= PIGEON_MAIL_CAP） */
  mailTipFull: 'roof/mail-tip-full',
  btnPrepare: 'home/btn-prepare',
  iconStar: 'icons/home/star',
  iconRiceStar: 'roof/star-rice',
  iconItems: 'icons/roof/items',
  iconShop: 'icons/home/shop',
  iconHome: 'icons/roof/home',
  iconPrepare: 'icons/home/prepare',
  iconGrid: 'icons/common/settings-grid',
  /** 屋顶底部坐着的角色装饰 */
  charShen: 'roof/char-shen',
  charBiao: 'roof/char-biao',
  charMi: 'roof/char-mi',
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
  iconGrid: 'icons/common/settings-grid',
  priceTag: 'shop/price-tag',
  btnBuy: 'shop/btn-buy',
  btnBuyDisabled: 'shop/btn-buy-disabled',
  /** 底部侧键：背包 / 扭蛋（顶栏无扭蛋） */
  sideBtnBag: 'shop/side-btn-bag',
  sideBtnGacha: 'shop/side-btn-gacha',
} as const;

export const GACHA_ASSETS = {
  iconBack: 'icons/shop/back',
  iconStar: 'icons/home/star',
  iconRiceStar: 'roof/star-rice',
  iconGrid: 'icons/common/settings-grid',
  /** 整页背景（含地毯等，勿再单独出地毯） */
  pageBg: 'gacha/page-bg',
  machine: 'gacha/machine',
  btnSpin: 'gacha/btn-spin',
  btnDraw1: 'gacha/btn-draw-1',
  btnDraw5: 'gacha/btn-draw-5',
  btnPrizes: 'gacha/btn-prizes',
  exchangeBanner: 'gacha/exchange-banner',
  resultPanel: 'gacha/result-panel',
  /** 结果格底图；实物 icon 叠在其上 */
  resultItemBg: 'gacha/result-item-bg',
  btnConfirm: 'gacha/btn-confirm',
  catalogPanel: 'gacha/catalog-panel',
  /** ⚠️ catalog-panel 文件内容实为物品格星爆底图（与 result-item-bg 同图），勿当弹窗面板用 */
  prizeLocked: 'icons/gacha/prize-locked',
} as const;

/** 展示柜：层板已画进 cabinet 背景；详情小方块 = 底图 + 纪念品叠放 */
export const SHOWCASE_ASSETS = {
  iconBack: 'icons/shop/back',
  iconGrid: 'icons/common/settings-grid',
  cabinet: 'showcase/cabinet',
  detailPanel: 'showcase/detail-panel',
  /** 详情弹窗内纪念品方块底图 */
  detailItemBg: 'showcase/detail-item-bg',
} as const;

/** 日记：书脊/天气/吉祥物已画进 notebook */
export const DIARY_ASSETS = {
  iconBack: 'icons/shop/back',
  iconGrid: 'icons/common/settings-grid',
  frame: 'diary/frame',
  notebook: 'diary/notebook',
  tab: 'diary/tab',
  tabActive: 'diary/tab-active',
  /** 格子半透明底图；明信片切图叠其上 */
  gridCell: 'diary/grid-cell',
  /** 信封按钮（含角标） */
  envelope: 'icons/diary/envelope',
} as const;

/** 信件：date 标签 / 天气 / logo 已画进信纸；展开即收下，无按钮 */
export const LETTER_ASSETS = {
  paper: 'diary/letter-paper',
} as const;

/** 信箱：deco-2 为整板（标题/提示已画进）；panel 棕色条为列表行背景 */
export const MAILBOX_ASSETS = {
  panel: 'mailbox/deco-2',
  rowBg: 'mailbox/panel',
  iconClose: 'mailbox/icon-close',
  /** 信封按钮（含角标） */
  envelope: 'icons/diary/envelope',
} as const;

/** 背包面板：槽位/标签已画进 panel；出发按钮含 GO 气泡 */
export const BAG_ASSETS = {
  panel: 'bag/panel',
  btnDepart: 'bag/btn-depart',
} as const;

export const INVENTORY_ASSETS = {
  panel: 'inventory/panel',
  /** 美食 Tab：未选 / 选中（选中更高） */
  tabFood: 'inventory/tab-food',
  tabFoodOn: 'inventory/tab-food-on',
  /** 道具 Tab：未选 / 选中（选中更高） */
  tabProp: 'inventory/tab-prop',
  tabPropOn: 'inventory/tab-prop-on',
  /** 列表行背景框（每件物品一块；其上叠 icon + 文字） */
  itemRow: 'inventory/item-row',
} as const;

export const DEPART_ASSETS = {
  panel: 'depart/panel',
  btnWait: 'depart/btn-wait',
  /** 真出发按钮待美术；勿再使用曾错映的回家提示图 */
  btnConfirm: 'depart/btn-confirm',
} as const;

export const TRIP_ASSETS = {
  /** 出门提示整图（文案在图上） */
  bannerDepart: 'shared/trip-banner',
  /** 回家提示整图（文案在图上） */
  bannerReturn: 'shared/trip-banner-return',
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
/** 设置弹窗：标题已画进 panel */
export const SETTINGS_ASSETS = {
  panel: 'settings/panel',
  toggleOn: 'settings/toggle-on',
  toggleOff: 'settings/toggle-off',
  userIdBar: 'settings/user-id-bar',
  /** 通知开/关两个按钮常驻同显；-selected 选中态，-us(unselected) 未选中态 */
  notifyOnSel: 'settings/notification-on-selected',
  notifyOnUnsel: 'settings/notification-on-us',
  notifyOffSel: 'settings/notification-off-selected',
  notifyOffUnsel: 'settings/notification-off-us',
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
  /** 米子图标，跟随进度条填充末端 */
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
