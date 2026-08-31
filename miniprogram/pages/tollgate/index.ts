import { readDevice } from '../../utils/device';

Page({
  data: {
    model: '',
    width: 0,
    dpr: 0,
  },

  onLoad() {
    const d = readDevice();
    this.setData({
      model: d.model,
      width: d.windowWidth,
      dpr: d.pixelRatio,
    });
  },
});
