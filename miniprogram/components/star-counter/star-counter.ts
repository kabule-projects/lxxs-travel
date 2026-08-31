Component({
  properties: {
    count: { type: Number, value: 0 },
    iconSrc: { type: String, value: '' },
  },

  data: {
    iconFailed: false,
  },

  methods: {
    onIconError() {
      this.setData({ iconFailed: true });
    },
  },
});
