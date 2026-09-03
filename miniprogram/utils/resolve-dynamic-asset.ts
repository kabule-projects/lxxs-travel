import { assetWebp, assetWebpCandidates, preloadFirstAvailable } from './asset-path';

/** 已是可直接用于 image src 的路径 */
export function isAbsoluteAssetPath(path: string): boolean {
  if (!path) return true;
  return (
    path.startsWith('/') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('cloud://') ||
    path.startsWith('wxfile://')
  );
}

/** 将库内相对路径（如 postcards/letter-1）解析为本地 WebP URL */
export async function resolveDynamicAsset(path: string): Promise<string> {
  if (!path || isAbsoluteAssetPath(path)) return path;
  try {
    return await preloadFirstAvailable(assetWebpCandidates(path));
  } catch {
    return assetWebp(path);
  }
}

export async function resolveDynamicAssetFields<T extends Record<string, unknown>>(
  item: T,
  keys: (keyof T)[],
): Promise<T> {
  const patch = { ...item };
  await Promise.all(
    keys.map(async (key) => {
      const val = item[key];
      if (typeof val === 'string' && val && !isAbsoluteAssetPath(val)) {
        (patch as Record<string, unknown>)[key as string] = await resolveDynamicAsset(val);
      }
    }),
  );
  return patch;
}

export async function resolveDynamicAssetList<T extends Record<string, unknown>>(
  items: T[],
  keys: (keyof T)[],
): Promise<T[]> {
  return Promise.all(items.map((item) => resolveDynamicAssetFields(item, keys)));
}
