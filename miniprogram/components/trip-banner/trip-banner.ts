import { TRIP_ASSETS } from '../../utils/asset-path';
import { resolveAsset } from '../../utils/resolve-assets';
import { skipTrip } from '../../services/trip';
import { getProfile } from '../../store/user';
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
    /** 点过"不跳过"后本次 banner 内不再显示套组 */
    skipDismissed: false,
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
    // 每次出门 banner 重新出现：重置"不跳过"选择，并读取最新券数
    visible(visible: boolean) {
      if (visible && this.data.mode === 'depart') {
        this.setData({
          skipDismissed: false,
          skipTickets: getProfile()?.skipTickets || 0,
        });
      }
    },
  },

  methods: {
    /** 点击遮罩/横幅任意处立即关闭，页面其他交互随之恢复 */
    onTap() {
      this.triggerEvent('dismiss');
    },

    /** 套组容器吞点击：点按钮间隙不关闭 banner */
    onStop() {},

    /** 不跳过：仅隐藏套组，banner 保留（5 秒自动消失或点其他区域关闭） */
    onTapDontSkip() {
      playTap();
      this.setData({ skipDismissed: true });
    },

    /** 跳过：消耗 1 张券把旅行快进到结束，随后宿主页走正常回家横幅流程 */
    async onTapSkip() {
      if (this._skipping) return;
      if (this.data.skipTickets <= 0) {
        playTap();
        wx.showToast({ title: '暂无跳过机会', icon: 'none' });
        return;
      }
      this._skipping = true;
      try {
        const res = await skipTrip();
        // 服务内已更新本地券数并 emit TRIP_RETURNED（宿主页随后展示回家横幅）
        if (res.skip) this.setData({ skipTickets: res.skip.tickets });
        // 关闭出门 banner 并清掉宿主页的 5 秒定时器
        this.triggerEvent('dismiss');
      } catch (e) {
        wx.showToast({ title: (e as Error).message || '跳过失败', icon: 'none' });
      } finally {
        this._skipping = false;
      }
    },
  },
});
