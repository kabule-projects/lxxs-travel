Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    image: { type: String, value: '' },
    story: { type: String, value: '' },
  },

  methods: {
    onStop() {},
    onClose() {
      this.triggerEvent('close');
    },
    onClaim() {
      this.triggerEvent('claim');
    },
  },
});
