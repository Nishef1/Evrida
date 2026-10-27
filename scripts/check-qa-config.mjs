import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const resolveConfig = require('../app.config.js');
const base = require('../app.json').expo;
const previous = process.env.EVRIDA_BUILD_VARIANT;
try {
  delete process.env.EVRIDA_BUILD_VARIANT;
  const prod = resolveConfig({ config: base });
  process.env.EVRIDA_BUILD_VARIANT = 'qa';
  const qa = resolveConfig({ config: base });
  assert.equal(prod.android.package, 'com.nishef.evrida');
  assert.equal(prod.ios.bundleIdentifier, 'com.nishef.evrida');
  assert.equal(qa.android.package, 'com.nishef.evrida.qa');
  assert.equal(qa.ios.bundleIdentifier, 'com.nishef.evrida.qa');
  assert.notEqual(prod.scheme, qa.scheme);
  assert.notEqual(prod.name, qa.name);
  const profiles = JSON.parse(readFileSync('eas.json', 'utf8'));
  assert.equal(profiles.build['e2e-test'].env.EVRIDA_BUILD_VARIANT, 'qa');
  assert.equal(profiles.build['e2e-test'].withoutCredentials, true);
  for (const file of ['.maestro/navigation.yml', '.maestro/quick-capture.yml', '.eas/workflows/native-smoke.yml']) {
    assert.equal(existsSync(file), true, file + ' is missing');
  }
  console.log('Native QA isolation: valid production/QA identities and smoke-test configuration.');
} finally {
  if (previous === undefined) delete process.env.EVRIDA_BUILD_VARIANT;
  else process.env.EVRIDA_BUILD_VARIANT = previous;
}
