import { once } from 'node:events';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createPool } from './db.js';
import { createShutdown } from './lifecycle.js';
import { createLogger } from './logger.js';
import { createPostgresStore } from './store.js';

// До чтения конфигурации действует уровень по умолчанию: ошибка .env всё равно попадёт в журнал.
let logger = createLogger();
let pool;

try {
  const config = readConfig();
  logger = createLogger({ level: config.logLevel });
  pool = createPool(config.connectionString, logger);
  const store = createPostgresStore(pool);
  await store.ping();

  const app = createApp({
    store,
    enableDebugReset: config.enableDebugReset,
    logger,
    releaseVersion: config.releaseVersion,
  });
  const server = app.listen(config.port, config.host);
  // once() отклоняется событием error: занятый порт попадает в общий catch.
  await once(server, 'listening');
  logger.info('server_started', {
    host: config.host,
    port: config.port,
    environment: config.environment,
    version: config.releaseVersion,
    debugReset: config.enableDebugReset,
  });

  const shutdown = createShutdown({ server, pool, logger });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    // once: повторный сигнал получает стандартную реакцию Node и принудительно
    // завершает процесс, если корректная остановка зависла.
    process.once(signal, () => {
      shutdown(signal).then(
        () => {
          process.exitCode = 0;
        },
        () => {
          process.exitCode = 1;
        },
      );
    });
  }
} catch (error) {
  // Только код и текст: в объекте ошибки pg может оказаться адрес и имя роли,
  // а строку подключения не печатаем никогда.
  logger.error('server_start_failed', { code: error.code, message: error.message });
  if (pool) {
    await pool.end().catch(() => {});
  }
  process.exitCode = 1;
}
