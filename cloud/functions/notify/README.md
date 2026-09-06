# notify 云函数

设置弹窗通知开关的云端同步 + 小深旅行归来订阅消息发送。

## 部署步骤

1. 在微信公众平台(mp.weixin.qq.com)「订阅通知」创建**一次性订阅**消息模板
   （建议：thing 类关键词如"小深旅行回来啦" + time 类关键词），把模板 ID 填入
   `miniprogram/config/notify.ts` 的 `TRIP_RETURN_TMPL_ID`。
2. 微信开发者工具中右键 `cloud/functions/notify` 上传并部署（云端安装依赖）。
3. 若云开发控制台要求确认权限，允许 `subscribeMessage.send`
   （`package.json` 的 `permissions.openapi` 已声明）。
4. `cloud/functions/common/notify.js` 中 `data` 的 keyword（thing1/time2）需与
   mp 后台模板关键词一致，不一致时发送会报错，按实际模板调整。

## action

- `subscribe`（tmplId）：users 置 `notifyEnabled/notifyPending/notifyTmplId`，记一次待消费授权。
- `unsubscribe`：users 清除上述字段。

发送触发点在 `cloud/functions/common/trip-lifecycle.js` 的 `advanceTrip`
（traveling → returned 唯一翻转点），由 `sendTripReturnNotice(openid)` 异步执行。
