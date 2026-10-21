// Чистые функции: без React, DOM, сети, случайных значений и изменения аргументов.
// Точные контракты и допустимые входы приведены в методичке.
const PRIORITIES = ['low', 'medium', 'high'];
const MAX_TITLE_LENGTH = 100;

// '2' -> 2; '2x', '1.5', '' и всё нечисловое -> null
function toCategoryId(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

export function validateTaskDraft(draft, categories) {
  const errors = {};

  const title = typeof draft?.title === 'string' ? draft.title.trim() : '';
  if (title.length === 0) {
    errors.title = 'Введите название задачи.';
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Название длиннее ${MAX_TITLE_LENGTH} символов.`;
  }

  const priority = draft?.priority;
  if (!PRIORITIES.includes(priority)) {
    errors.priority = 'Выберите приоритет из списка.';
  }

  const categoryId = toCategoryId(draft?.categoryId);
  if (categoryId === null || !categories.some(category => category.id === categoryId)) {
    errors.categoryId = 'Выберите категорию из списка.';
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, value: valid ? { title, priority, categoryId } : null, errors };
}

export function selectTasks(tasks, filters) {
  const q = filters.q.trim().toLowerCase();
  return tasks.filter(task =>
    (q === '' || task.title.toLowerCase().includes(q))
    && (filters.completed === '' || task.completed === (filters.completed === 'true'))
    && (filters.priority === '' || task.priority === filters.priority)
    && (filters.categoryId === '' || task.categoryId === Number(filters.categoryId)));
}

export function getTaskStats(tasks) {
  const completed = tasks.filter(task => task.completed).length;
  return { total: tasks.length, completed, active: tasks.length - completed };
}

export function addTask(tasks, value, id) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Некорректный id: ${id}`);
  }
  if (tasks.some(task => task.id === id)) {
    throw new Error(`Задача с id ${id} уже есть`);
  }
  return [...tasks, { id, ...value, completed: false }];
}

export function updateTask(tasks, id, value) {
  if (!tasks.some(task => task.id === id)) return tasks;
  return tasks.map(task => task.id === id
    ? { ...task, title: value.title, priority: value.priority, categoryId: value.categoryId }
    : task);
}

export function toggleTask(tasks, id) {
  if (!tasks.some(task => task.id === id)) return tasks;
  return tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
}

export function removeTask(tasks, id) {
  if (!tasks.some(task => task.id === id)) return tasks;
  return tasks.filter(task => task.id !== id);
}
