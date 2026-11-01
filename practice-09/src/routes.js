import { Router } from 'express';
import { ApiError } from './errors.js';
import { parseFilters, parsePositiveId } from './validation.js';

const ALLOW = 'GET, HEAD, OPTIONS';

function methodNotAllowed(req, res, next) {
  res.set('Allow', ALLOW);
  next(new ApiError(405, 'METHOD_NOT_ALLOWED', `Метод ${req.method} не поддерживается для этого пути.`));
}

export function createRouter(store) {
  const router = Router({ caseSensitive: true });
  router.get('/health', (req, res) => res.json({ data: { status: 'ok' } }));

  router.get('/categories', (req, res) => {
    const data = store.listCategories();
    res.json({ data, meta: { total: data.length } });
  });

  router.get('/tasks', (req, res) => {
    // req.query теряет повторы и разбирает вложенные ключи, поэтому берём исходную строку запроса
    const { searchParams } = new URL(req.originalUrl, 'http://localhost');
    const filters = parseFilters(searchParams);
    const data = store.listTasks(filters);
    res.json({ data, meta: { total: data.length, filters } });
  });

  router.get('/tasks/:id', (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      throw new ApiError(400, 'INVALID_ID', 'id задачи должен быть положительным целым числом.');
    }
    const task = store.getTask(id);
    if (!task) {
      throw new ApiError(404, 'TASK_NOT_FOUND', 'Задача не найдена.', { id });
    }
    res.json({ data: task });
  });

  // GET-маршруты выше уже ответили на GET и HEAD; сюда доходят остальные методы
  router.all(['/health', '/categories', '/tasks', '/tasks/:id'], methodNotAllowed);
  return router;
}
