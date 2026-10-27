const { withGradleProperties } = require("expo/config-plugins");

// Expo's default MaxMetaspaceSize=512m makes the Gradle/Kotlin daemons die with
// "out of JVM Metaspace" while compiling the SDK 58 native modules.
const KEY = "org.gradle.jvmargs";
const VALUE = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

module.exports = config => withGradleProperties(config, config => {
  const properties = config.modResults;
  const existing = properties.find(item => item.type === "property" && item.key === KEY);
  if (existing) existing.value = VALUE;
  else properties.push({ type: "property", key: KEY, value: VALUE });
  return config;
});
