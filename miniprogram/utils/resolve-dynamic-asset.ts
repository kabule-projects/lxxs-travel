import { assetWebp, assetWebpCandidates, preloadFirstAvailable } from './asset-path';

/** cloud:// fileID 需要换成 https 临时链接才能给 <image> 用，缓存避免重复请求 */
const TEMP_URL_CACHE_TTL_MS = 30 * 60 * 1000;
const tempUrlCache = new Map<string, { url: string; expiresAt: number }>();

function isCloudFileId(path: string): boolean {
  return !!path && path.startsWith('cloud://');
}

/** 批量换取临时链接（单次最多 50 个，自动分批），失败时回退原 cloud:// 路径 */
async function getCloudTempUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(isCloudFileId)));
  const stale = unique.filter((p) => {
    const hit = tempUrlCache.get(p);
    return !hit || hit.expiresAt <= Date.now();
  });
  for (let i = 0; i < stale.length; i += 50) {
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: stale.slice(i, i + 50) });
      for (const f of res.fileList) {
        if (f.status === 0 && f.tempFileURL) {
          tempUrlCache.set(f.fileID, {
            url: f.tempFileURL,
            expiresAt: Date.now() + TEMP_URL_CACHE_TTL_MS,
          });
        } else {
          console.warn('[asset] getTempFileURL 失败', f.fileID, f.status, f.errMsg);
        }
      }
    } catch (err) {
      console.warn('[asset] getTempFileURL 异常', err);
    }
  }
  const map = new Map<string, string>();
  for (const p of unique) {
    const hit = tempUrlCache.get(p);
    map.set(p, hit ? hit.url : p);
  }
  return map;
}

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

/** 将库内相对路径（如 postcards/letter-1）解析为本地 WebP URL；cloud:// 换成 https 临时链接 */
export async function resolveDynamicAsset(path: string): Promise<string> {
  if (!path) return path;
  if (isCloudFileId(path)) {
    const map = await getCloudTempUrls([path]);
    return map.get(path) || path;
  }
  if (isAbsoluteAssetPath(path)) return path;
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
      if (typeof val === 'string' && val && (isCloudFileId(val) || !isAbsoluteAssetPath(val))) {
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
  // 先批量换取临时链接（并预热缓存），再逐条解析剩余本地路径
  const cloudPaths: string[] = [];
  items.forEach((item) => {
    keys.forEach((key) => {
      const val = item[key];
      if (typeof val === 'string' && isCloudFileId(val)) cloudPaths.push(val);
    });
  });
  await getCloudTempUrls(cloudPaths);
  return Promise.all(items.map((item) => resolveDynamicAssetFields(item, keys)));
}
