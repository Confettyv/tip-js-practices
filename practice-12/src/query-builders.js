export const taskColumns = `
  id,
  title,
  completed,
  priority,
  category_id AS "categoryId"`;

// В LIKE/ILIKE символы %, _ и \ имеют специальный смысл. API ПР10 выполнял
// буквальный поиск подстроки, поэтому перед добавлением % их нужно экранировать.
export function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

// Пары «ключ фильтра → фиксированный SQL-фрагмент». Из запроса в SQL попадает
// только номер параметра, сами значения уходят отдельно в values.
const filterColumns = [
  ['completed', 'completed'],
  ['priority', 'priority'],
  ['categoryId', 'category_id'],
];

export function buildListTasksQuery(filters) {
  const conditions = [];
  const values = [];

  for (const [key, column] of filterColumns) {
    if (filters[key] === null || filters[key] === undefined) continue;
    values.push(filters[key]);
    conditions.push(`${column} = $${values.length}`);
  }

  if (filters.q) {
    values.push(`%${escapeLikePattern(filters.q)}%`);
    conditions.push(`title ILIKE $${values.length} ESCAPE '\\'`);
  }

  const where = conditions.length > 0 ? `\n  WHERE ${conditions.join(' AND ')}` : '';
  return {
    text: `SELECT ${taskColumns}\n  FROM public.tasks${where}\n  ORDER BY id`,
    values,
  };
}

// Порядок фиксирован: SQL-текст зависит только от набора полей, а не от
// порядка ключей в теле запроса.
const updatableColumns = [
  ['title', 'title'],
  ['completed', 'completed'],
  ['priority', 'priority'],
  ['categoryId', 'category_id'],
];
const updatableKeys = new Set(updatableColumns.map(([key]) => key));

export function buildUpdateTaskQuery(id, changes) {
  const unknown = Object.keys(changes).filter(key => !updatableKeys.has(key));
  if (unknown.length > 0) throw new Error(`Неизвестные поля для обновления: ${unknown.join(', ')}.`);

  const assignments = [];
  const values = [];
  for (const [key, column] of updatableColumns) {
    // hasOwn, а не проверка на истинность: completed = false тоже изменение
    if (!Object.hasOwn(changes, key)) continue;
    values.push(changes[key]);
    assignments.push(`${column} = $${values.length}`);
  }
  if (assignments.length === 0) throw new Error('Нет полей для изменения.');

  values.push(id);
  return {
    text: `UPDATE public.tasks SET ${assignments.join(', ')}\n  WHERE id = $${values.length}\n  RETURNING ${taskColumns}`,
    values,
  };
}
