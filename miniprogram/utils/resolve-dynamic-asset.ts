import { assetCdnBase } from './asset-path';

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

/** cloud:// fileID → 云存储 CDN 直链。
 * cloud://{envId}.{bucket}/{path} → https://{bucket}.tcb.qcloud.la/{path}
 * 直链免 getTempFileURL 换链往返，且 URL 固定可被 CDN 边缘缓存；
 * 前提：存储权限「所有用户可读」（content/items 与 content/ui 同 bucket，已开） */
export function cloudFileIdToCdnUrl(fileID: string): string {
  const m = /^cloud:\/\/([^.]+)\.([^/]+)\/(.+)$/.exec(fileID);
  return m ? `https://${m[2]}.tcb.qcloud.la/${m[3]}` : fileID;
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

/** 将库内相对路径（如 postcards/letter-1）解析为云存储 CDN 直链；cloud:// 直接转 CDN 直链（不匹配的格式回退 getTempFileURL） */
export async function resolveDynamicAsset(path: string): Promise<string> {
  if (!path) return path;
  if (isCloudFileId(path)) {
    const direct = cloudFileIdToCdnUrl(path);
    if (direct !== path) return direct;
    const map = await getCloudTempUrls([path]);
    return map.get(path) || path;
  }
  if (isAbsoluteAssetPath(path)) return path;
  return assetCdnBase(path);
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
  // cloud:// → CDN 直链为纯字符串转换，无需预热身；
  // 仅个别不匹配格式才在 resolveDynamicAsset 内单独 getTempFileURL
  return Promise.all(items.map((item) => resolveDynamicAssetFields(item, keys)));
}
