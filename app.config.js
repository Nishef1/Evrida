// The isolated QA app runs the release bundle without touching the user's app data.
module.exports = ({ config }) => process.env.EVRIDA_BUILD_VARIANT === 'qa' ? {
  ...config,
  name: 'Evrida QA',
  scheme: 'evrida-qa',
  android: { ...config.android, package: `${config.android.package}.qa` },
  ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.qa` },
} : config;
