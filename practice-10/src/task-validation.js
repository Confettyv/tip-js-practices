import { ApiError } from './errors.js';

const EDITABLE = ['title', 'priority', 'categoryId'];
const PRIORITIES = ['low', 'medium', 'high'];
const MAX_TITLE = 100;

// Каждое правило возвращает текст ошибки или null; value здесь уже точно передано.
const rules = {
  title: (value) => {
    if (typeof value !== 'string') return 'Название должно быть строкой.';
    const length = value.trim().length;
    if (length === 0) return 'Название обязательно.';
    return length > MAX_TITLE ? `Название не длиннее ${MAX_TITLE} символов.` : null;
  },
  priority: (value) => (PRIORITIES.includes(value) ? null : 'Приоритет: low, medium или high.'),
  categoryId: (value, categoryIds) => {
    if (!Number.isSafeInteger(value) || value < 1) return 'categoryId должен быть положительным целым числом.';
    return categoryIds.has(value) ? null : 'Неизвестная категория.';
  },
  completed: (value) => (typeof value === 'boolean' ? null : 'completed должен быть true или false.'),
};

// categoryIds — Set существующих id категорий.
// Возвращает новый объект только с переданными разрешёнными полями; вход не изменяется.
export function validateTaskInput(value, { partial = false, categoryIds } = {}) {
  // details без прототипа: ключ "__proto__" из JSON сохранится как обычное поле
  const details = Object.create(null);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    details.body = 'Тело запроса должно быть JSON-объектом.';
    throw new ApiError(400, 'VALIDATION_ERROR', 'Данные не прошли проверку.', details);
  }

  const allowed = partial ? [...EDITABLE, 'completed'] : EDITABLE;
  // Object.keys возвращает и собственный ключ "__proto__", созданный JSON.parse
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    details[key] = key === 'id' || key === 'completed'
      ? `Поле ${key} назначается сервером.`
      : `Неизвестное поле ${key}.`;
  }

  const result = {};
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) {
      if (!partial) details[key] = 'Поле обязательно.';
      continue;
    }
    const message = rules[key](value[key], categoryIds);
    if (message) details[key] = message;
    else result[key] = key === 'title' ? value[key].trim() : value[key];
  }
  if (partial && !allowed.some(key => Object.hasOwn(value, key)) && Object.keys(details).length === 0) {
    details.body = 'Передайте хотя бы одно изменяемое поле.';
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Данные не прошли проверку.', details);
  }
  return result;
}
