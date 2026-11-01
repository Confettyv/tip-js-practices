import { ApiError } from './errors.js';

const ID_PATTERN = /^[1-9]\d*$/;
const PRIORITIES = ['low', 'medium', 'high'];
const ALLOWED = ['completed', 'priority', 'categoryId', 'q'];
const MAX_QUERY_LENGTH = 100;

// raw: строка; результат: безопасное положительное целое либо null.
export function parsePositiveId(raw) {
  if (typeof raw !== 'string' || !ID_PATTERN.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function invalidQuery(message, details) {
  return new ApiError(400, 'INVALID_QUERY', message, details);
}

// URLSearchParams -> { completed, priority, categoryId, q }.
// Сначала имена, затем повторы, затем значения: так ошибка указывает на первую причину.
export function parseFilters(searchParams) {
  const names = [...searchParams.keys()];
  const unknown = names.find(name => !ALLOWED.includes(name));
  if (unknown !== undefined) {
    throw invalidQuery(`Неизвестный параметр: ${unknown}.`, { param: unknown });
  }
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated !== undefined) {
    throw invalidQuery(`Параметр ${repeated} указан несколько раз.`, { param: repeated });
  }

  const filters = { completed: null, priority: null, categoryId: null, q: '' };

  if (searchParams.has('completed')) {
    const raw = searchParams.get('completed');
    if (raw !== 'true' && raw !== 'false') {
      throw invalidQuery('completed принимает только true или false.', { param: 'completed' });
    }
    filters.completed = raw === 'true';
  }
  if (searchParams.has('priority')) {
    const raw = searchParams.get('priority');
    if (!PRIORITIES.includes(raw)) {
      throw invalidQuery('priority принимает low, medium или high.', { param: 'priority' });
    }
    filters.priority = raw;
  }
  if (searchParams.has('categoryId')) {
    const id = parsePositiveId(searchParams.get('categoryId'));
    if (id === null) {
      throw invalidQuery('categoryId должен быть положительным целым числом.', { param: 'categoryId' });
    }
    filters.categoryId = id;
  }
  if (searchParams.has('q')) {
    const q = searchParams.get('q').trim();
    if (q.length > MAX_QUERY_LENGTH) {
      throw invalidQuery(`q не длиннее ${MAX_QUERY_LENGTH} символов.`, { param: 'q' });
    }
    filters.q = q;
  }
  return filters;
}
