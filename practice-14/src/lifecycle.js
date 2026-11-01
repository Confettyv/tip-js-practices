import { performance } from 'node:perf_hooks';

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      // Сервер, который уже не слушает порт, для завершения не помеха.
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// Возвращает shutdown(signal). Функция не вызывает process.exit(): код выхода
// назначает точка входа, поэтому последовательность проверяется unit-тестами.
export function createShutdown({ server, pool, logger, timeoutMs = 10_000 } = {}) {
  if (!server || !pool || !logger) {
    throw new TypeError('Для завершения требуются server, pool и logger.');
  }
  let pending;

  return function shutdown(signal) {
    // Второй сигнал (Ctrl+C, затем SIGTERM от платформы) не запускает закрытие заново.
    if (pending) {
      return pending;
    }
    const startedAt = performance.now();
    logger.info('shutdown_started', { signal, timeoutMs });

    // close() перестаёт принимать подключения и ждёт текущие запросы;
    // pool закрывается после HTTP, чтобы последние запросы успели дойти до базы.
    const work = (async () => {
      try {
        await closeServer(server);
      } finally {
        await pool.end();
      }
    })();

    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        // Зависшие соединения обрываются, иначе процесс не выйдет и после таймаута.
        server.closeAllConnections?.();
        reject(new Error(`Завершение не уложилось в ${timeoutMs} мс.`));
      }, timeoutMs);
    });

    const durationMs = () => Math.round(performance.now() - startedAt);
    pending = Promise.race([work, deadline])
      .then(
        () => logger.info('shutdown_completed', { signal, durationMs: durationMs() }),
        (error) => {
          logger.error('shutdown_failed', {
            signal,
            durationMs: durationMs(),
            message: error.message,
          });
          throw error;
        },
      )
      .finally(() => clearTimeout(timer));
    return pending;
  };
}
