/** 订阅消息模板 ID，需在微信公众平台(mp.weixin.qq.com)创建"旅行归来"类一次性订阅模板后填入 */
export const TRIP_RETURN_TMPL_ID = '';

/** 是否已配置模板 */
export function isNotifyConfigured(): boolean {
  return TRIP_RETURN_TMPL_ID.length > 0;
}
