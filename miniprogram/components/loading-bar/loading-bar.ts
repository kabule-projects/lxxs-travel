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
    thumbSrc: { type: String, value: '' },
  },

  lifetimes: {
    attached() {
      this.resolveAssets();
    },
  },

  methods: {
    async resolveAssets() {
      const track = this.properties.trackSrc;
      if (track) return;

      const [trackSrc, fillSrc, thumbSrc] = await Promise.all([
        preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.barTrack)).catch(
          () => assetWebp(LOADING_ASSETS.barTrack),
        ),
        preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.barFill)).catch(
          () => assetWebp(LOADING_ASSETS.barFill),
        ),
        preloadFirstAvailable(assetWebpCandidates(LOADING_ASSETS.barThumb)).catch(
          () => assetWebp(LOADING_ASSETS.barThumb),
        ),
      ]);

      this.setData({ trackSrc, fillSrc, thumbSrc });
    },

    onTrackError() {
      console.warn('[loading-bar] track webp failed');
    },
  },
});
