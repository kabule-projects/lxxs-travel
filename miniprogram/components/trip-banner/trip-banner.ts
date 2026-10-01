import { TRIP_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';
import { skipTrip } from '../../services/trip';
import { getProfile, patchProfile } from '../../store/user';
import { playTap } from '../../services/sound';

Component({
  properties: {
    visible: { type: Boolean, value: false },
    /** depart = 出门提示图；return = 回家提示图（文案在图内） */
    mode: { type: String, value: 'depart' },
    /** mode=return 时：true=带回纪念品 / false=空手回家，切换两种回家图 */
    returnHasSouvenir: { type: Boolean, value: true },
  },

  data: {
    departSrc: '',
    returnSrc: '',
    returnEmptySrc: '',
    /** 跳过套组三张贴图 */
    skipOrNotBg: '',
    skipDontSrc: '',
    skipDoSrc: '',
    /** 剩余跳过券张数（users.skipTickets），banner 出现时从 profile 读取 */
    skipTickets: 0,
  },

  /** 跳过请求进行中，防连点 */
  _skipping: false as boolean,

  lifetimes: {
    attached() {
      Promise.all([
        resolveAsset(TRIP_ASSETS.bannerDepart),
        resolveAsset(TRIP_ASSETS.bannerReturn),
        resolveAsset(TRIP_ASSETS.bannerReturnEmpty),
        resolveAsset(TRIP_ASSETS.skipOrNotBg),
        resolveAsset(TRIP_ASSETS.skipDont),
        resolveAsset(TRIP_ASSETS.skipDo),
      ]).then(([departSrc, returnSrc, returnEmptySrc, skipOrNotBg, skipDontSrc, skipDoSrc]) => {
        this.setData({ departSrc, returnSrc, returnEmptySrc, skipOrNotBg, skipDontSrc, skipDoSrc });
      });
    },
  },

  observers: {
    // 每次出门 banner 重新出现：读取最新券数（>0 显示套组、=0 走 5 秒自动消失）
    visible(visible: boolean) {
      if (visible && this.data.mode === 'depart') {
        this.setData({ skipTickets: getProfile()?.skipTickets || 0 });
      }
    },
  },

  methods: {
    /** 点击遮罩/横幅：无券（无套组）时立即关闭；有券时必须在套组上做选择，不允许点遮罩关闭 */
    onTap() {
      if (this.data.mode === 'depart' && this.data.skipTickets > 0) return;
      this.triggerEvent('dismiss');
    },

    /** 套组容器吞点击：点按钮间隙不关闭 banner */
    onStop() {},

    /** 继续旅行（不跳过）：关闭出门 banner */
    onTapDontSkip() {
      playTap();
      this.triggerEvent('dismiss');
    },

    /** 跳过：消耗 1 张券把旅行快进到结束，随后宿主页走正常回家横幅流程 */
    async onTapSkip() {
      if (this._skipping) return;
      this._skipping = true;
      try {
        const res = await skipTrip();
        // 服务内已更新本地券数并 emit TRIP_RETURNED（宿主页随后展示回家横幅）
        if (res.skip) this.setData({ skipTickets: res.skip.tickets });
        // 关闭出门 banner（有券时宿主页没开自动消失定时器，由这里负责关闭）
        this.triggerEvent('dismiss');
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'NO_TICKET') {
          // 本地券数过期（云端实际为 0）：同步为 0（套组随之隐藏）并关闭 banner，避免用户被困住
          patchProfile({ skipTickets: 0 });
          this.setData({ skipTickets: 0 });
          this.triggerEvent('dismiss');
        } else {
          wx.showToast({ title: (e as Error).message || '跳过失败', icon: 'none' });
        }
      } finally {
        this._skipping = false;
      }
    },
  },
});
