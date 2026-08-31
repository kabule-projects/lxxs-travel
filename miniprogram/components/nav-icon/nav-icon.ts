Component({
  properties: {
    src: { type: String, value: '' },
    label: { type: String, value: '' },
    size: { type: String, value: 'md' },
  },

  data: {
    failed: false,
  },

  methods: {
    onError() {
      this.setData({ failed: true });
    },
    onTap() {
      this.triggerEvent('tap');
    },
  },
});
