import { call } from './api';

/** 资源 manifest 条目 */
export interface AssetManifestEntry {
  path: string;
  hash: string;
  w: number;
  h: number;
  dpr: number[];
  fileID?: string;
}

const manifestCache = new Map<string, AssetManifestEntry>();

export async function fetchManifest(): Promise<AssetManifestEntry[]> {
  const list = await call<AssetManifestEntry[]>('manifest', { action: 'list' });
  list.forEach((e) => manifestCache.set(e.path, e));
  return list;
}

export function pickDpr(pixelRatio: number): 2 | 3 {
  return pixelRatio >= 2.75 ? 3 : 2;
}

export async function getSignedUrl(fileID: string): Promise<string> {
  const res = await call<{ url: string }>('manifest', {
    action: 'getSignedUrl',
    payload: { fileID },
  });
  return res.url;
}

export function getCachedEntry(path: string): AssetManifestEntry | undefined {
  return manifestCache.get(path);
}
