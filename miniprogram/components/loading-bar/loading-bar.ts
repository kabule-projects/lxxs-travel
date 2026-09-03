import {
  assetWebp,
  assetWebpCandidates,
  LOADING_ASSETS,
  preloadFirstAvailable,
} from '../../utils/asset-path';

Component({
  properties: {
    progress: {
      type: Number,
      value: 0,
    },
    trackSrc: { type: String, value: '' },
    fillSrc: { type: String, value: '' },
    /** 米子图标；默认 loading/bar-thumb */
    thumbSrc: { type: String, value: '' },
  },

  data: {
    displayTrack: '',
    displayFill: '',
    displayThumb: '',
  },

  observers: {
    'trackSrc, fillSrc, thumbSrc'(trackSrc: string, fillSrc: string, thumbSrc: string) {
      if (trackSrc || fillSrc || thumbSrc) {
        this.setData({
          displayTrack: trackSrc || this.data.displayTrack,
          displayFill: fillSrc || this.data.displayFill,
          displayThumb: thumbSrc || this.data.displayThumb,
        });
      }
    },
  },

  lifetimes: {
    attached() {
      this.resolveAssets();
    },
  },

  methods: {
    async resolveAssets() {
      const { trackSrc, fillSrc, thumbSrc } = this.properties;
      if (trackSrc && fillSrc && thumbSrc) {
        this.setData({
          displayTrack: trackSrc,
          displayFill: fillSrc,
          displayThumb: thumbSrc,
        });
        return;
      }

      const [track, fill, thumb] = await Promise.all([
        trackSrc
          ? Promise.resolve(trackSrc)
          : preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.barTrack)).catch(() =>
              assetWebp(LOADING_ASSETS.barTrack),
            ),
        fillSrc
          ? Promise.resolve(fillSrc)
          : preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.barFill)).catch(() =>
              assetWebp(LOADING_ASSETS.barFill),
            ),
        thumbSrc
          ? Promise.resolve(thumbSrc)
          : preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.barThumb)).catch(() =>
              assetWebp(LOADING_ASSETS.barThumb),
            ),
      ]);

      this.setData({
        displayTrack: track,
        displayFill: fill,
        displayThumb: thumb,
      });
    },

    onTrackError() {
      console.warn('[loading-bar] track webp failed');
    },
  },
});
