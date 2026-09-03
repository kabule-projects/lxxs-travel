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

export { readDevice, readSafeArea, isSupported, isSupportedOrDevtools, isSupportedDevice };
