import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/logger.js';
import { createFakeStore } from '../support/fake-store.js';
import { request, startServer } from '../support/http.js';

// Регрессия ПР12: ошибки подключения создаёт Node или драйвер pg, SQLSTATE у
// них нет. Без отдельной обработки API отвечал 500 вместо 503. В контейнере
// остановленный db ещё и не резолвится по имени (EAI_AGAIN/ENOTFOUND).
async function withFailingStore(error, run) {
  const chunks = [];
  const logger = createLogger({ output: { write: (chunk) => chunks.push(chunk) } });
  const store = createFakeStore();
  store.listTasks = async () => {
    throw error;
  };
  const running = await startServer(createApp({ store, logger }));
  try {
    await run(running.origin, () => chunks.map((chunk) => JSON.parse(chunk)));
  } finally {
    await running.close();
  }
}

test('отказ подключения без SQLSTATE даёт 503 DATABASE_UNAVAILABLE', async () => {
  const failures = [
    Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }),
    Object.assign(new Error('getaddrinfo EAI_AGAIN db'), { code: 'EAI_AGAIN' }),
    new Error('timeout exceeded when trying to connect'),
    new Error('Connection terminated unexpectedly'),
  ];
  for (const failure of failures) {
    await withFailingStore(failure, async (origin) => {
      const { response, body } = await request(origin, '/api/tasks');
      assert.equal(response.status, 503, failure.message);
      assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(JSON.stringify(body).includes('5432'), false);
    });
  }
});

test('непредвиденная ошибка: клиенту 500 без деталей, в журнал событие с request id', async () => {
  const failure = new Error('column "titel" does not exist');
  await withFailingStore(failure, async (origin, records) => {
    const { response, body } = await request(origin, '/api/tasks', {
      headers: { 'X-Request-Id': 'trace-500' },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(body, {
      error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка API.' },
    });
    const logged = records();
    const unhandled = logged.find((record) => record.event === 'unhandled_error');
    assert.equal(unhandled.requestId, 'trace-500');
    assert.equal(unhandled.message, failure.message);
    assert.equal(unhandled.stack, undefined);
    const access = logged.find((record) => record.event === 'http_request');
    assert.equal(access.level, 'error');
    assert.equal(access.status, 500);
  });
});
