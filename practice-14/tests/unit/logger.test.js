import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createLogger, requestLogger } from '../../src/logger.js';
import { request, startServer } from '../support/http.js';

const fixedClock = () => new Date('2026-11-02T09:00:00.000Z');

function memoryOutput() {
  const chunks = [];
  return {
    write: (chunk) => chunks.push(chunk),
    chunks,
    records: () => chunks.map((chunk) => JSON.parse(chunk)),
  };
}

test('logger пишет одну JSON-запись с обязательными полями', () => {
  const output = memoryOutput();
  const logger = createLogger({ output, clock: fixedClock });
  logger.info('server_started', { port: 5505, level: 'попытка подмены' });

  assert.equal(output.chunks.length, 1);
  assert.match(output.chunks[0], /^\{.*\}\n$/);
  assert.equal(output.chunks[0].split('\n').length, 2);
  // Поле события не может подменить служебный уровень записи.
  assert.deepEqual(output.records()[0], {
    timestamp: '2026-11-02T09:00:00.000Z',
    level: 'info',
    event: 'server_started',
    port: 5505,
  });
});

test('logger отбрасывает события ниже настроенного уровня', () => {
  const output = memoryOutput();
  const logger = createLogger({ level: 'warn', output, clock: fixedClock });
  logger.debug('d');
  logger.info('i');
  logger.warn('w');
  logger.error('e');
  assert.deepEqual(
    output.records().map((record) => [record.level, record.event]),
    [
      ['warn', 'w'],
      ['error', 'e'],
    ],
  );
  assert.throws(() => createLogger({ level: 'verbose', output }), /уровень/);
});

test('logger скрывает password, authorization, cookie и connectionString', () => {
  const output = memoryOutput();
  const logger = createLogger({ output, clock: fixedClock });
  const cyclic = { name: 'cycle' };
  cyclic.self = cyclic;
  logger.warn('sensitive', {
    Password: 'p1',
    request: { headers: { Authorization: 'Bearer t', COOKIE: 'sid=1', accept: 'json' } },
    targets: [{ connectionString: 'postgresql://u:p@h/db' }],
    cyclic,
  });

  const [record] = output.records();
  assert.equal(record.Password, '[REDACTED]');
  assert.deepEqual(record.request.headers, {
    Authorization: '[REDACTED]',
    COOKIE: '[REDACTED]',
    accept: 'json',
  });
  assert.equal(record.targets[0].connectionString, '[REDACTED]');
  assert.equal(record.cyclic.self, '[Circular]');
  for (const secret of ['p1', 'Bearer t', 'sid=1', 'u:p@h']) {
    assert.equal(output.chunks[0].includes(secret), false, secret);
  }
});

test('requestLogger возвращает X-Request-Id и фиксирует метод, путь, статус и durationMs', async () => {
  const output = memoryOutput();
  const logger = createLogger({ output, clock: fixedClock });
  const ticks = [100, 104.24];
  const app = express();
  app.use(
    requestLogger({ logger, createRequestId: () => 'generated-1', clock: () => ticks.shift() }),
  );
  app.post('/api/tasks', (req, res) => res.status(201).json({ ok: true }));

  const running = await startServer(app);
  try {
    const { response } = await request(running.origin, '/api/tasks?q=секретный+поиск', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'не должен попасть в лог' }),
    });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('x-request-id'), 'generated-1');
  } finally {
    await running.close();
  }

  const records = output.records();
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    timestamp: '2026-11-02T09:00:00.000Z',
    level: 'info',
    event: 'http_request',
    requestId: 'generated-1',
    method: 'POST',
    path: '/api/tasks',
    status: 201,
    durationMs: 4.2,
  });
  assert.equal(output.chunks[0].includes('секрет'), false);
});
