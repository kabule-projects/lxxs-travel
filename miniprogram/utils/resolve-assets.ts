import { assetWebp } from './asset-path';

/** 解析 WebP 路径：按设备 dpr 直接拼 CDN 链接（云上各 dpr 变体齐全，无需探测） */
export async function resolveAsset(key: string): Promise<string> {
  return assetWebp(key);
}

export async function resolveAssetMap<T extends Record<string, string>>(
  map: T,
): Promise<Record<keyof T, string>> {
  const entries = await Promise.all(
    Object.entries(map).map(async ([k, v]) => [k, await resolveAsset(v)] as const),
  );
  return Object.fromEntries(entries) as Record<keyof T, string>;
}
