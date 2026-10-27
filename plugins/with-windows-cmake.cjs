const { withAppBuildGradle } = require("expo/config-plugins");

// SDK 58's gesture-handler codegen object paths exceed the Android SDK Ninja
// 1.10's 260-character limit on Windows, even with LongPathsEnabled. Shorten
// them: stage CMake output at the repository root and cap object names.
module.exports = config => withAppBuildGradle(config, config => {
  const marker = "// Evrida: keep Windows C++ object paths within Ninja's limit.";
  const stagingMarker = "// Evrida: use the short repository-root CMake staging path on Windows.";
  const gradle = config.modResults;
  if (gradle.language !== "groovy" || !/android\s*\{/.test(gradle.contents) || !/defaultConfig\s*\{/.test(gradle.contents)) {
    throw new Error("Windows CMake configuration requires Groovy android and defaultConfig blocks.");
  }
  if (!gradle.contents.includes(stagingMarker)) {
    gradle.contents = gradle.contents.replace(/android\s*\{/, `android {
    ${stagingMarker}
    if (System.getProperty("os.name").startsWith("Windows")) {
        externalNativeBuild {
            cmake { buildStagingDirectory = file("$rootDir/../.cxx") }
        }
    }
`);
  }
  if (!gradle.contents.includes(marker)) gradle.contents = gradle.contents.replace(/defaultConfig\s*\{/, `defaultConfig {
        ${marker}
        if (System.getProperty("os.name").startsWith("Windows")) {
            externalNativeBuild {
                cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" }
            }
        }`);
  return config;
});
