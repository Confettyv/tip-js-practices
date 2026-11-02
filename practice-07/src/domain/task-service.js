// Чистые функции: без React, DOM, сети, случайных значений и изменения аргументов.
// Функции изменения возвращают новый массив, а для неизвестного id — тот же.

export const PRIORITIES = Object.freeze(['low', 'medium', 'high']);
export const TITLE_MAX = 100;

// Только запись из одних цифр: Number('2x') даёт NaN, а parseInt('2x') — 2.
function toCategoryId(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return Number.NaN;
}

export function validateTaskDraft(draft, categories) {
  const errors = {};

  const title = typeof draft?.title === 'string' ? draft.title.trim() : '';
  if (typeof draft?.title !== 'string' || title.length === 0) {
    errors.title = 'Введите название задачи.';
  } else if (title.length > TITLE_MAX) {
    errors.title = `Не длиннее ${TITLE_MAX} символов, сейчас ${title.length}.`;
  }

  const priority = draft?.priority;
  if (!PRIORITIES.includes(priority)) {
    errors.priority = 'Выберите приоритет: низкий, средний или высокий.';
  }

  const categoryId = toCategoryId(draft?.categoryId);
  if (draft?.categoryId === '' || draft?.categoryId == null) {
    errors.categoryId = 'Выберите категорию.';
  } else if (!Number.isSafeInteger(categoryId) || !categories.some(category => category.id === categoryId)) {
    errors.categoryId = 'Такой категории нет в справочнике.';
  }

  return { valid: Object.keys(errors).length === 0, value: { title, priority, categoryId }, errors };
}

// Пустая строка отключает фильтр. completed сравнивается со строкой явно:
// Boolean('false') === true, и такой фильтр показал бы все задачи.
export function selectTasks(tasks, filters) {
  const needle = filters.q.trim().toLocaleLowerCase('ru-RU');
  return tasks.filter(task =>
    (needle === '' || task.title.toLocaleLowerCase('ru-RU').includes(needle))
    && (filters.completed === '' || task.completed === (filters.completed === 'true'))
    && (filters.priority === '' || task.priority === filters.priority)
    && (filters.categoryId === '' || task.categoryId === Number(filters.categoryId)));
}

export function getTaskStats(tasks) {
  const completed = tasks.filter(task => task.completed).length;
  return { total: tasks.length, completed, active: tasks.length - completed };
}

export function addTask(tasks, value, id) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RangeError(`id должен быть положительным целым числом, получено ${String(id)}.`);
  }
  if (tasks.some(task => task.id === id)) {
    throw new RangeError(`id ${id} уже занят.`);
  }
  const { title, priority, categoryId } = value;
  return [...tasks, { id, title, priority, categoryId, completed: false }];
}

// Общая часть update и toggle: новая запись только у найденной задачи,
// остальные объекты переиспользуются по ссылке.
function replaceTask(tasks, id, change) {
  if (!tasks.some(task => task.id === id)) return tasks;
  return tasks.map(task => (task.id === id ? { ...task, ...change(task) } : task));
}

export function updateTask(tasks, id, value) {
  const { title, priority, categoryId } = value;
  return replaceTask(tasks, id, () => ({ title, priority, categoryId }));
}

export function toggleTask(tasks, id) {
  return replaceTask(tasks, id, task => ({ completed: !task.completed }));
}

export function removeTask(tasks, id) {
  if (!tasks.some(task => task.id === id)) return tasks;
  return tasks.filter(task => task.id !== id);
}

// Учебный локальный id: максимум полного набора + 1, для пустого — 1.
// Длина массива дала бы повтор после удаления из середины.
export function nextTaskId(tasks) {
  return tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}

// Дополнительное задание: сортировка выборки без изменения исходного массива.
// toSorted возвращает копию; сортировка стабильна, поэтому при равных ключах
// сохраняется исходный порядок.
export const SORT_OPTIONS = Object.freeze({
  none: 'Как в наборе',
  title: 'По названию',
  'priority-desc': 'Сначала высокий приоритет',
});

const PRIORITY_RANK = Object.freeze({ high: 0, medium: 1, low: 2 });
const titleCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

export function sortTasks(tasks, sort) {
  if (sort === 'title') return tasks.toSorted((a, b) => titleCollator.compare(a.title, b.title));
  if (sort === 'priority-desc') return tasks.toSorted((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  return tasks;
}
