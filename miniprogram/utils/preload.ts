import {
  assetWebp,
  HOME_ASSETS,
  SHOP_ASSETS,
  GACHA_ASSETS,
  SHOWCASE_ASSETS,
  DIARY_ASSETS,
  LETTER_ASSETS,
  MAILBOX_ASSETS,
  BAG_ASSETS,
  INVENTORY_ASSETS,
  DEPART_ASSETS,
  PROFILE_ASSETS,
  WARDROBE_ASSETS,
  SETTINGS_ASSETS,
  TRIP_ASSETS,
} from './asset-path';

/**
 * 并行预载图片，写入微信图片缓存；全部完成或超时兜底后 resolve，单张失败不阻塞。
 */
export function preloadImages(urls: string[], timeoutMs = 5000): Promise<void> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (!unique.length) return Promise.resolve();
  const all = Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          wx.getImageInfo({ src, success: () => resolve(), fail: () => resolve() });
        }),
    ),
  );
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]).then(
    () => {},
  );
}

/** 按资产 key 清单预载（assetWebp 拼 CDN 链接后走 preloadImages） */
export function preloadAssetKeys(keys: string[], timeoutMs = 5000): Promise<void> {
  return preloadImages(keys.map((k) => assetWebp(k)), timeoutMs);
}

let _idleWarmed = false;

/**
 * 屋顶 idle 时预热其余页面的 UI 资产（会话内只跑一次）。
 * 扭蛋开奖动画（get_one/get_five，单张 ~24MB）刻意排除，不预热。
 */export function preloadOtherPagesAssets(): void {
  if (_idleWarmed) return;
  _idleWarmed = true;
  const gachaKeys = Object.entries(GACHA_ASSETS)
    .filter(([k]) => k !== 'machineOne' && k !== 'machineFive')
    .map(([, v]) => v);
  const keys = [
    ...Object.values(HOME_ASSETS),
    ...Object.values(SHOP_ASSETS),
    ...gachaKeys,
    ...Object.values(SHOWCASE_ASSETS),
    ...Object.values(DIARY_ASSETS),
    ...Object.values(LETTER_ASSETS),
    ...Object.values(MAILBOX_ASSETS),
    ...Object.values(BAG_ASSETS),
    ...Object.values(INVENTORY_ASSETS),
    ...Object.values(DEPART_ASSETS),
    ...Object.values(PROFILE_ASSETS),
    ...Object.values(WARDROBE_ASSETS),
    ...Object.values(SETTINGS_ASSETS),
    ...Object.values(TRIP_ASSETS),
  ];
  void preloadImages(keys.map((k) => assetWebp(k)), 15000);
}
