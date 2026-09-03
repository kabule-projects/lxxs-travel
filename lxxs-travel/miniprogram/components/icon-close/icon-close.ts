Component({
  properties: {
    src: { type: String, value: '' },
    size: { type: Number, value: 64 },
  },

  methods: {
    onTap() {
      this.triggerEvent('tap');
    },
  },
});
