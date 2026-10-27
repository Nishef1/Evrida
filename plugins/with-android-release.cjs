const { withGradleProperties } = require('expo/config-plugins');

// Use AGP's release-only R8 and resource shrinker. Debug builds stay unminified;
// Expo and React Native's consumer rules retain their dynamic native entrypoints.
module.exports = config => withGradleProperties(config, config => {
  for (const key of ['android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds']) {
    const existing = config.modResults.find(item => item.type === 'property' && item.key === key);
    if (existing) existing.value = 'true';
    else config.modResults.push({ type: 'property', key, value: 'true' });
  }
  return config;
});
