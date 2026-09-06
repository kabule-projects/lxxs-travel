/** 旅行归来订阅通知：本地开关 + 微信订阅消息授权同步 */

import { call } from './api';
import { isNotifyConfigured, TRIP_RETURN_TMPL_ID } from '../config/notify';

const STORAGE_KEY = 'lxxs_notify_enabled';

let enabled = readStorage();

function readStorage(): boolean {
  try {
    return !!wx.getStorageSync(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return false;
}

export function getNotifyEnabled(): boolean {
  return enabled;
}

export function setNotifyEnabled(v: boolean) {
  enabled = v;
  try {
    wx.setStorageSync(STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
}

/** 请求订阅消息授权；用户允许才 resolve(true)，拒绝/取消/未配置模板均 resolve(false) */
export function requestNotifyAuth(): Promise<boolean> {
  if (!isNotifyConfigured()) {
    wx.showToast({ title: '通知即将开放', icon: 'none' });
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [TRIP_RETURN_TMPL_ID],
      fail: (err) => {
        console.warn('requestSubscribeMessage fail', err);
      },
      complete: (res) => {
        resolve(res[TRIP_RETURN_TMPL_ID] === 'accept');
      },
    });
  });
}

/** 云端记录订阅（用户开通知时调用）；失败只告警，不阻塞设置弹窗 */
export async function syncNotifySubscribe() {
  try {
    await call('notify', { action: 'subscribe', tmplId: TRIP_RETURN_TMPL_ID });
  } catch (e) {
    console.warn('syncNotifySubscribe fail', e);
  }
}

/** 云端清除订阅（用户关通知时调用）；失败只告警 */
export async function syncNotifyUnsubscribe() {
  try {
    await call('notify', { action: 'unsubscribe' });
  } catch (e) {
    console.warn('syncNotifyUnsubscribe fail', e);
  }
}
