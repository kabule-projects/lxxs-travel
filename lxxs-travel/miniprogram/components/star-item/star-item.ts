Component({
  properties: {
    starId: { type: String, value: '' },
    kind: { type: String, value: 'dropped' },
    type: { type: String, value: 'normal' },
    src: { type: String, value: '' },
    left: { type: Number, value: 0 },
    top: { type: Number, value: 0 },
    rotate: { type: Number, value: 0 },
    zIndex: { type: Number, value: 3 },
    remainText: { type: String, value: '' },
  },

  data: {
    failed: false,
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
