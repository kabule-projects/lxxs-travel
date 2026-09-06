declare namespace WechatMiniprogram {
  interface Wx {
    cloud: {
      init(options: { env?: string; traceUser?: boolean }): void;
      callFunction(options: {
        name: string;
        data?: Record<string, unknown>;
      }): Promise<{ result: unknown }>;
      /** 换取云文件临时访问链接（<image> 不认 cloud://，必须用 https 临时链接） */
      getTempFileURL(options: {
        fileList: string[];
      }): Promise<{
        fileList: Array<{
          fileID: string;
          tempFileURL?: string;
          status?: number;
          errMsg?: string;
        }>;
      }>;
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
    /** 右上角胶囊按钮（关闭/菜单）布局矩形 */
    getMenuButtonBoundingClientRect?(): {
      top: number;
      bottom: number;
      left: number;
      right: number;
      width: number;
      height: number;
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
    /** 订阅消息授权结果：各模板 id → accept / reject / ban 等 */
    requestSubscribeMessage(options: {
      tmplIds: string[];
      success?: (res: Record<string, 'accept' | 'reject' | 'ban' | string>) => void;
      fail?: (err: unknown) => void;
      complete?: (res: Record<string, 'accept' | 'reject' | 'ban' | string>) => void;
    }): void;
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
