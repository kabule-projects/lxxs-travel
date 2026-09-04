export interface DeviceInfo {
  windowWidth: number;
  pixelRatio: number;
  platform: string;
  model: string;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 右上角胶囊按钮布局（px），right/bottom 为距屏幕边缘距离 */
export interface CapsuleRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

function readDevice(): DeviceInfo {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const sys = wx.getSystemInfoSync();
  return {
    windowWidth: info.windowWidth || 375,
    pixelRatio: info.pixelRatio || 2,
    platform: sys.platform || 'unknown',
    model: sys.model || 'unknown',
  };
}

function readSafeArea(): SafeAreaInsets {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const sa = info.safeArea;
  const screenH = info.screenHeight || info.windowHeight || 812;
  const screenW = info.screenWidth || info.windowWidth || 375;
  if (!sa) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  return {
    top: sa.top,
    bottom: Math.max(0, screenH - sa.bottom),
    left: sa.left,
    right: Math.max(0, screenW - sa.right),
  };
}

/**
 * 读取右上角胶囊（关闭/菜单）布局矩形。
 * 自定义导航页用它避让：HUD 整体放到胶囊下方，或右侧留出胶囊宽度。
 */
function readCapsuleRect(): CapsuleRect {
  try {
    const rect = wx.getMenuButtonBoundingClientRect?.();
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const screenW = info.screenWidth || info.windowWidth || 375;
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: Math.max(0, screenW - rect.right),
        width: rect.width,
        height: rect.height,
      };
    }
  } catch {
    /* fallthrough */
  }
  // 兜底：iOS 常见胶囊位置（top≈44, height≈32）
  return { top: 44, bottom: 76, left: 280, right: 7, width: 88, height: 32 };
}

function isSupportedDevice(info: DeviceInfo): boolean {
  const { windowWidth: width, pixelRatio: dpr } = info;
  const iphoneOk = width >= 375 && width <= 440;
  const androidHi = dpr >= 2.5 && width >= 360 && width <= 430;
  return iphoneOk || androidHi;
}

function isSupported(): boolean {
  return isSupportedDevice(readDevice());
}

function isSupportedOrDevtools(): boolean {
  const info = readDevice();
  const sys = wx.getSystemInfoSync();
  if (sys.platform === 'devtools') return true;
  return isSupportedDevice(info);
}

export { readDevice, readSafeArea, readCapsuleRect, isSupported, isSupportedOrDevtools, isSupportedDevice };
