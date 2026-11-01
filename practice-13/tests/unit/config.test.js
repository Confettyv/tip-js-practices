import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../../src/config.js';

test('readConfig читает полную корректную конфигурацию', () => {
  const config = readConfig({
    API_PORT: '5513',
    DATABASE_URL: 'postgresql://user:password@127.0.0.1:5432/test',
    ENABLE_DEBUG_RESET: 'true',
  });
  assert.deepEqual(config, {
    port: 5513,
    connectionString: 'postgresql://user:password@127.0.0.1:5432/test',
    enableDebugReset: true,
  });
});

test('readConfig использует безопасные значения по умолчанию', () => {
  const config = readConfig({ DATABASE_URL: 'postgresql://example' });
  assert.equal(config.port, 5505);
  assert.equal(config.enableDebugReset, false);
});

const validUrl = 'postgresql://tip_app:s3cret-pass@127.0.0.1:5432/tip_tasks_test';

test('readConfig отклоняет отсутствие DATABASE_URL и строку из пробелов', () => {
  for (const env of [{}, { DATABASE_URL: '' }, { DATABASE_URL: '   \t ' }]) {
    assert.throws(() => readConfig(env), /DATABASE_URL/, JSON.stringify(env));
  }
});

test('readConfig отклоняет порт вне диапазона и нечисловой порт', () => {
  for (const port of ['1023', '65536', '0', '-5505', 'abc', '', '5505.5', '1e4']) {
    assert.throws(
      () => readConfig({ API_PORT: port, DATABASE_URL: validUrl }),
      (error) => /API_PORT/.test(error.message) && !error.message.includes('s3cret-pass'),
      port,
    );
  }
  assert.equal(readConfig({ API_PORT: '1024', DATABASE_URL: validUrl }).port, 1024);
  assert.equal(readConfig({ API_PORT: '65535', DATABASE_URL: validUrl }).port, 65535);
});

test('readConfig принимает только true или false для ENABLE_DEBUG_RESET', () => {
  assert.equal(
    readConfig({ DATABASE_URL: validUrl, ENABLE_DEBUG_RESET: 'false' }).enableDebugReset,
    false,
  );
  for (const flag of ['TRUE', '1', 'yes', ' true', '']) {
    assert.throws(
      () => readConfig({ DATABASE_URL: validUrl, ENABLE_DEBUG_RESET: flag }),
      /ENABLE_DEBUG_RESET/,
      JSON.stringify(flag),
    );
  }
});

// Вариант 1: порт должен иметь одну запись. Ведущий ноль, пробелы и хвост
// после числа отклоняются, хотя Number() или parseInt() дали бы 5505.
test('вариант 1: readConfig отклоняет API_PORT с ведущим нулём, пробелами и хвостом', () => {
  for (const port of ['01', '05505', ' 5505', '5505 ', ' 5505 ', '5505abc', '+5505', '0x15B3']) {
    assert.throws(
      () => readConfig({ API_PORT: port, DATABASE_URL: validUrl }),
      /API_PORT/,
      JSON.stringify(port),
    );
  }
});
