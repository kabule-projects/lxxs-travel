Component({
  properties: {
    visible: { type: Boolean, value: true },
    src: { type: String, value: '' },
    floating: { type: Boolean, value: true },
  },

  data: {
    useFallback: false,
  },

  observers: {
    src() {
      this.setData({ useFallback: false });
    },
  },

  methods: {
    onError() {
      this.setData({ useFallback: true });
    },
  },
});
