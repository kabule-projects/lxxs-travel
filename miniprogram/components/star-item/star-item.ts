Component({
  properties: {
    starId: { type: String, value: '' },
    kind: { type: String, value: 'dropped' },
    type: { type: String, value: 'normal' },
    src: { type: String, value: '' },
    glowSrc: { type: String, value: '' },
    left: { type: Number, value: 0 },
    top: { type: Number, value: 0 },
    rotate: { type: Number, value: 0 },
    zIndex: { type: Number, value: 3 },
    remainText: { type: String, value: '' },
  },

  data: {
    failed: false,
    /** 闪烁动画随机相位（负延迟，初始即处于周期中任意点，避免整屏同步） */
    glowDelay: 0,
  },

  lifetimes: {
    attached() {
      this.setData({ glowDelay: -Math.random() * 3 });
    },
  },

  methods: {
    onError() {
      this.setData({ failed: true });
    },
    onTap() {
      if (this.properties.kind !== 'dropped') return;
      this.triggerEvent('collect', { id: this.properties.starId });
    },
  },
});
