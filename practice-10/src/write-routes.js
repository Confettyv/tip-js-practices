import { ApiError } from './errors.js';
import { jsonBody } from './json-body.js';
import { requireTask } from './task-resource.js';
import { validateTaskInput } from './task-validation.js';

function categoryIds(store) {
  return new Set(store.listCategories().map(category => category.id));
}

function taskNotFound(id) {
  return new ApiError(404, 'TASK_NOT_FOUND', 'Задача не найдена.', { id });
}

export function registerWriteRoutes(router, store) {
  router.post('/tasks', ...jsonBody, (req, res) => {
    const value = validateTaskInput(req.body, { categoryIds: categoryIds(store) });
    const task = store.createTask(value);
    res.status(201).location(`/api/tasks/${task.id}`).json({ data: task });
  });

  // requireTask стоит до jsonBody: неверный или отсутствующий id отвечает раньше разбора тела
  router.patch('/tasks/:id', requireTask(store), ...jsonBody, (req, res) => {
    const changes = validateTaskInput(req.body, { partial: true, categoryIds: categoryIds(store) });
    // Пока читалось тело, запись могла удалить другая операция
    const task = store.updateTask(req.task.id, changes);
    if (!task) throw taskNotFound(req.task.id);
    res.json({ data: task });
  });

  router.delete('/tasks/:id', requireTask(store), (req, res) => {
    if (!store.deleteTask(req.task.id)) throw taskNotFound(req.task.id);
    res.status(204).end();
  });
}
