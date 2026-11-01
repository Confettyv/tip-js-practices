import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../../src/config.js';

const base = { DATABASE_URL: 'postgresql://x' };

test('readConfig читает API_HOST и отклоняет пробельное значение', () => {
  assert.equal(readConfig(base).host, '127.0.0.1');
  assert.equal(readConfig({ ...base, API_HOST: '0.0.0.0' }).host, '0.0.0.0');
  for (const API_HOST of ['', '   ', 'local host', 'a'.repeat(256)]) {
    assert.throws(() => readConfig({ ...base, API_HOST }), /API_HOST/, JSON.stringify(API_HOST));
  }
  assert.equal(readConfig({ ...base, API_HOST: 'h'.repeat(255) }).host.length, 255);
});

test('readConfig применяет безопасные значения NODE_ENV, LOG_LEVEL и RELEASE_VERSION', () => {
  const defaults = readConfig(base);
  assert.equal(defaults.environment, 'development');
  assert.equal(defaults.logLevel, 'info');
  assert.equal(defaults.releaseVersion, '0.0.0-local');

  const explicit = readConfig({
    ...base,
    NODE_ENV: 'production',
    LOG_LEVEL: 'warn',
    RELEASE_VERSION: '1.0.0-rc_1',
  });
  assert.equal(explicit.environment, 'production');
  assert.equal(explicit.logLevel, 'warn');
  assert.equal(explicit.releaseVersion, '1.0.0-rc_1');
  assert.equal(explicit.enableDebugReset, false);
});

test('readConfig отклоняет неизвестные environment, log level и release version', () => {
  for (const NODE_ENV of ['prod', 'Production', '']) {
    assert.throws(() => readConfig({ ...base, NODE_ENV }), /NODE_ENV/);
  }
  for (const LOG_LEVEL of ['trace', 'INFO', '']) {
    assert.throws(() => readConfig({ ...base, LOG_LEVEL }), /LOG_LEVEL/);
  }
  for (const RELEASE_VERSION of ['', '1.0.0 beta', 'v1/2', 'x'.repeat(65)]) {
    assert.throws(() => readConfig({ ...base, RELEASE_VERSION }), /RELEASE_VERSION/);
  }
  assert.equal(readConfig({ ...base, RELEASE_VERSION: 'x'.repeat(64) }).releaseVersion.length, 64);
});

test('readConfig запрещает ENABLE_DEBUG_RESET=true в production', () => {
  assert.throws(
    () => readConfig({ ...base, NODE_ENV: 'production', ENABLE_DEBUG_RESET: 'true' }),
    /ENABLE_DEBUG_RESET.*production/,
  );
  // Вне production учебный сброс по-прежнему доступен по явному флагу.
  for (const NODE_ENV of ['development', 'test']) {
    assert.equal(
      readConfig({ ...base, NODE_ENV, ENABLE_DEBUG_RESET: 'true' }).enableDebugReset,
      true,
    );
  }
});
