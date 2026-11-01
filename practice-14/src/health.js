import express from 'express';

export function createHealthRouter({ store, releaseVersion = '0.0.0-local' } = {}) {
  if (!store) {
    throw new TypeError('Для health endpoints требуется хранилище.');
  }
  const router = express.Router();

  // Liveness отвечает только за сам процесс: отказ базы не повод его перезапускать.
  router.get('/live', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness решает, можно ли слать прикладные запросы. Причину отказа клиенту
  // не раскрываем: ни SQLSTATE, ни адреса, ни текста драйвера.
  router.get('/ready', async (req, res) => {
    try {
      await store.ping();
      res.json({ status: 'ready', version: releaseVersion });
    } catch {
      res.status(503).json({ status: 'not_ready', version: releaseVersion });
    }
  });

  return router;
}
