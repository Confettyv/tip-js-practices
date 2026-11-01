import assert from 'node:assert/strict';
import test from 'node:test';
import { createShutdown } from '../../src/lifecycle.js';

function recorder() {
  const steps = [];
  const logger = {
    events: [],
    info: (event, fields) => logger.events.push({ level: 'info', event, ...fields }),
    error: (event, fields) => logger.events.push({ level: 'error', event, ...fields }),
  };
  const server = {
    close(callback) {
      steps.push('server.close');
      setImmediate(callback);
    },
    closeAllConnections() {
      steps.push('server.closeAllConnections');
    },
  };
  const pool = {
    async end() {
      steps.push('pool.end');
    },
  };
  return { steps, logger, server, pool };
}

test('shutdown прекращает приём запросов, закрывает pool и пишет итоговый лог', async () => {
  const { steps, logger, server, pool } = recorder();
  await createShutdown({ server, pool, logger, timeoutMs: 1000 })('SIGTERM');

  // Сначала HTTP, затем база: текущие запросы успевают дописать в PostgreSQL.
  assert.deepEqual(steps, ['server.close', 'pool.end']);
  assert.deepEqual(
    logger.events.map((event) => event.event),
    ['shutdown_started', 'shutdown_completed'],
  );
  assert.equal(logger.events[1].signal, 'SIGTERM');
  assert.equal(typeof logger.events[1].durationMs, 'number');
});

test('повторный shutdown возвращает тот же promise и не закрывает ресурсы дважды', async () => {
  const { steps, logger, server, pool } = recorder();
  const shutdown = createShutdown({ server, pool, logger, timeoutMs: 1000 });
  const first = shutdown('SIGINT');
  const second = shutdown('SIGTERM');
  assert.equal(first, second);
  await first;
  await shutdown('SIGINT');
  assert.deepEqual(steps, ['server.close', 'pool.end']);
  assert.equal(logger.events.filter((event) => event.event === 'shutdown_started').length, 1);
});

test('shutdown завершается ошибкой после ограниченного таймаута', async () => {
  const { steps, logger, pool } = recorder();
  // Сервер, который никогда не закрывается: висящий keep-alive или долгий запрос.
  const server = {
    close() {
      steps.push('server.close');
    },
    closeAllConnections() {
      steps.push('server.closeAllConnections');
    },
  };
  const started = performance.now();
  await assert.rejects(createShutdown({ server, pool, logger, timeoutMs: 30 })('SIGTERM'), /30 мс/);
  assert.ok(performance.now() - started < 1000);
  assert.deepEqual(steps, ['server.close', 'server.closeAllConnections']);
  assert.equal(logger.events.at(-1).event, 'shutdown_failed');
  assert.equal(logger.events.at(-1).level, 'error');
});

test('shutdown сообщает об ошибке закрытия, но всё равно закрывает pool', async () => {
  const { steps, logger, pool } = recorder();
  const server = {
    close(callback) {
      steps.push('server.close');
      callback(Object.assign(new Error('close failed'), { code: 'EINVAL' }));
    },
  };
  await assert.rejects(
    createShutdown({ server, pool, logger, timeoutMs: 1000 })('SIGINT'),
    /close failed/,
  );
  assert.deepEqual(steps, ['server.close', 'pool.end']);
  assert.throws(() => createShutdown({ server, logger }), TypeError);
});
