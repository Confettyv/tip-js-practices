import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { createLogger, isSafeRequestId } from '../../src/logger.js';
import { createFakeStore } from '../support/fake-store.js';
import { request, startServer } from '../support/http.js';

// Вариант 1: входной X-Request-Id принимается только по безопасному шаблону
// с ограничением длины, иначе сервер выдаёт собственный UUID.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function sendWithId(value) {
  const chunks = [];
  const logger = createLogger({ output: { write: (chunk) => chunks.push(chunk) } });
  const running = await startServer(createApp({ store: createFakeStore(), logger }));
  try {
    const headers = value === undefined ? {} : { 'X-Request-Id': value };
    const { response } = await request(running.origin, '/health/live', { headers });
    return { header: response.headers.get('x-request-id'), log: chunks.join('') };
  } finally {
    await running.close();
  }
}

test('вариант 1: безопасный входной X-Request-Id сохраняется в ответе и журнале', async () => {
  for (const value of ['gateway-42', 'a1B2.c3_d4', 'x'.repeat(64)]) {
    const { header, log } = await sendWithId(value);
    assert.equal(header, value);
    assert.equal(JSON.parse(log).requestId, value);
  }
});

test('вариант 1: опасный или длинный X-Request-Id заменяется UUID сервера', async () => {
  const unsafe = [
    'x'.repeat(65),
    'a b',
    '{"level":"error"}',
    '../../etc/passwd',
    'id;drop',
    '<script>',
    'id\ttab',
    'id%0Aforged',
  ];
  for (const value of unsafe) {
    const { header, log } = await sendWithId(value);
    assert.match(header, uuid, value);
    assert.equal(JSON.parse(log).requestId, header);
    assert.equal(log.includes(value), false, value);
  }
  const missing = await sendWithId(undefined);
  assert.match(missing.header, uuid);
});

test('вариант 1: проверка шаблона на границах и нестроковых значениях', () => {
  assert.equal(isSafeRequestId(''), false);
  assert.equal(isSafeRequestId('a'), true);
  assert.equal(isSafeRequestId('a'.repeat(64)), true);
  assert.equal(isSafeRequestId('a'.repeat(65)), false);
  assert.equal(isSafeRequestId('line\nbreak'), false);
  assert.equal(isSafeRequestId(undefined), false);
  assert.equal(isSafeRequestId(['a', 'b']), false);
});
