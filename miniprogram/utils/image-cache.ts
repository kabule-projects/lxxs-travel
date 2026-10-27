/**
 * 图片本地持久化缓存（明信片大图等重资源用）：
 * 首次查看时 downloadFile + saveFile 存入本地持久化存储（跨会话有效），
 * 之后每次查看直接走本地文件，不再消耗 CDN 流量；
 * 下载/保存失败或本地文件被清理时回落原始 CDN 地址，行为等价于现状。
 * 机制与 services/sound.ts 的 SFX/BGM 本地缓存一致。
 */

const LOCAL_KEY = 'lxxs_pcimg_local_v1';

function readMap(): Record<string, string> {
  try {
    return (wx.getStorageSync(LOCAL_KEY) as Record<string, string>) || {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  try {
    wx.setStorageSync(LOCAL_KEY, map);
  } catch {
    /* 写失败不影响本次展示 */
  }
}

function fileExists(path: string): boolean {
  if (!path) return false;
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/** 同 URL 并发去重：并发的重复请求共享同一次下载 */
const inflight = new Map<string, Promise<string>>();

async function downloadAndSave(url: string): Promise<string> {
  const res = await new Promise<{ statusCode: number; tempFilePath: string }>(
    (resolve, reject) => {
      wx.downloadFile({ url, success: resolve, fail: reject },
      );
    },
  );
  if (res.statusCode !== 200) throw new Error('download fail ' + res.statusCode);
  const saved = await new Promise<string>((resolve, reject) => {
    wx.getFileSystemManager().saveFile({
      tempFilePath: res.tempFilePath,
      success: (r) => resolve(r.savedFilePath),
      fail: reject,
    });
  });
  return saved;
}

/**
 * 解析为本地持久化路径：本地已有直接返回（同步命中零流量）；
 * 否则后台下载保存后返回本地路径；任何失败回落原始 URL。
 * 调用方可直接用于 <image> src，命中前展示原 URL 亦可（可选的渐进优化）。
 */
export function resolvePersistentImage(url: string): Promise<string> {
  if (!url || !wx.downloadFile) return Promise.resolve(url);
  const map = readMap();
  const local = map[url];
  if (local && fileExists(local)) return Promise.resolve(local);
  if (inflight.has(url)) return inflight.get(url)!;
  const p = downloadAndSave(url)
    .then((saved) => {
      inflight.delete(url);
      map[url] = saved;
      writeMap(map);
      return saved;
    })
    .catch(() => {
      // 不用 finally（项目 target 低于 es2018）：失败回落原 URL，行为等价于现状
      inflight.delete(url);
      return url;
    });
  inflight.set(url, p);
  return p;
}
