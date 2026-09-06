/** 云开发环境 ID，部署后在微信开发者工具中填写，或通过 project.private.config.json 覆盖 */
export const CLOUD_ENV_ID = 'cloud1-d9ghjbijh5aa24e10';

/** 是否已配置真实环境（非占位） */
export function isCloudConfigured(): boolean {
  return CLOUD_ENV_ID !== 'lxxs-cloud-env-placeholder' && CLOUD_ENV_ID.length > 0;
}
