import { assetWebp, assetWebpCandidates, preloadFirstAvailable } from './asset-path';

/** 批量解析 WebP 路径（带回退预加载） */
export async function resolveAsset(key: string): Promise<string> {
  try {
    return await preloadFirstAvailable(assetWebpCandidates(key));
  } catch {
    return assetWebp(key);
  }
}

export async function resolveAssetMap<T extends Record<string, string>>(
  map: T,
): Promise<Record<keyof T, string>> {
  const entries = await Promise.all(
    Object.entries(map).map(async ([k, v]) => [k, await resolveAsset(v)] as const),
  );
  return Object.fromEntries(entries) as Record<keyof T, string>;
}
