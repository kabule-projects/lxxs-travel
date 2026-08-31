declare namespace WechatMiniprogram {
  interface Wx {
    cloud: {
      init(options: { env?: string; traceUser?: boolean }): void;
      callFunction(options: {
        name: string;
        data?: Record<string, unknown>;
      }): Promise<{ result: unknown }>;
    };
    getWindowInfo?(): {
      windowWidth: number;
      pixelRatio: number;
      screenHeight?: number;
      screenWidth?: number;
      windowHeight?: number;
      safeArea?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
        width: number;
        height: number;
      };
    };
    getSystemInfoSync(): {
      windowWidth: number;
      pixelRatio: number;
      platform: string;
      model: string;
    };
    getImageInfo(options: {
      src: string;
      success?: (res: unknown) => void;
      fail?: (err: unknown) => void;
    }): void;
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, data: unknown): void;
    reLaunch(options: { url: string }): void;
    navigateTo(options: {
      url: string;
      fail?: (err: unknown) => void;
    }): void;
    navigateBack(options?: { fail?: (err: unknown) => void }): void;
    showToast(options: { title: string; icon?: string }): void;
    nextTick(cb: () => void): void;
    createInnerAudioContext?(): {
      src: string;
      volume: number;
      play(): void;
      destroy(): void;
      onError(cb: () => void): void;
      onEnded(cb: () => void): void;
    };
  }
}

declare const wx: WechatMiniprogram.Wx;

declare function App<T extends WechatMiniprogram.IAnyObject>(options: T): void;
declare function Page<T extends WechatMiniprogram.IAnyObject>(options: T): void;
declare function getApp<T extends WechatMiniprogram.IAnyObject>(): T;

declare namespace WechatMiniprogram {
  interface IAnyObject {
    [key: string]: unknown;
  }
}
