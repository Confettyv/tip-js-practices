import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../src/errors.js';
import { validateTaskInput } from '../../src/task-validation.js';
import { parseFilters, parsePositiveId } from '../../src/validation.js';

const categories = new Set([1, 2, 3]);

test('parsePositiveId принимает диапазон integer PostgreSQL', () => {
  assert.equal(parsePositiveId('1'), 1);
  assert.equal(parsePositiveId('2147483647'), 2147483647);
});

test('parsePositiveId отклоняет неоднозначные и недопустимые значения', () => {
  for (const value of ['0', '-1', '+1', '01', '1.0', ' 1', '2147483648', 'abc']) {
    assert.equal(parsePositiveId(value), null, value);
  }
});

test('parseFilters разбирает полный набор фильтров', () => {
  const params = new URLSearchParams({
    completed: 'false',
    priority: 'high',
    categoryId: '2',
    q: '  ПРОВЕР  ',
  });
  assert.deepEqual(parseFilters(params), {
    completed: false,
    priority: 'high',
    categoryId: 2,
    q: 'ПРОВЕР',
  });
});

test('parseFilters возвращает нейтральные значения без query', () => {
  assert.deepEqual(parseFilters(new URLSearchParams()), {
    completed: null,
    priority: null,
    categoryId: null,
    q: '',
  });
});

test('parseFilters отклоняет неизвестный и повторённый параметр', () => {
  assert.throws(
    () => parseFilters(new URLSearchParams('page=1')),
    (error) => error instanceof ApiError && error.code === 'INVALID_QUERY',
  );
  assert.throws(
    () => parseFilters(new URLSearchParams('q=a&q=b')),
    (error) => error instanceof ApiError && error.code === 'INVALID_QUERY',
  );
});

test('validateTaskInput нормализует POST без изменения исходного объекта', () => {
  const source = { title: '  Новая задача  ', priority: 'medium', categoryId: 2 };
  const result = validateTaskInput(source, { categoryIds: categories });
  assert.deepEqual(result, { title: 'Новая задача', priority: 'medium', categoryId: 2 });
  assert.equal(source.title, '  Новая задача  ');
  assert.notEqual(result, source);
});

test('validateTaskInput сохраняет false при частичном обновлении', () => {
  assert.deepEqual(
    validateTaskInput({ completed: false }, { partial: true, categoryIds: categories }),
    { completed: false },
  );
});

// Контракт ошибки: класс, статус, код и набор полей details. Русский текст
// сообщений не сравнивается, чтобы редакторская правка не ломала тесты.
function rejects(value, options, expectedFields) {
  assert.throws(
    () => validateTaskInput(value, { categoryIds: categories, ...options }),
    (error) => {
      assert.ok(error instanceof ApiError, 'ожидалась ApiError');
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      if (expectedFields) {
        assert.deepEqual(Object.keys(error.details ?? {}).sort(), [...expectedFields].sort());
      }
      return true;
    },
    JSON.stringify(value),
  );
}

test('validateTaskInput отклоняет не-объект, массив и null', () => {
  for (const value of [null, [], ['title'], 'title', 42, true, new Date()]) {
    rejects(value, { partial: false });
    rejects(value, { partial: true });
  }
});

test('validateTaskInput сообщает обязательные и неизвестные поля POST', () => {
  rejects({}, {}, ['title', 'priority', 'categoryId']);
  rejects({ title: 'A', priority: 'low' }, {}, ['categoryId']);
  // completed назначает база, поэтому в POST оно запрещено так же, как id
  rejects({ title: 'A', priority: 'low', categoryId: 1, completed: true, id: 5 }, {}, [
    'completed',
    'id',
  ]);
});

test('validateTaskInput отклоняет пустой PATCH и несуществующую категорию', () => {
  rejects({}, { partial: true }, ['body']);
  rejects({ owner: 'me' }, { partial: true }, ['owner', 'body']);
  rejects({ categoryId: 999 }, { partial: true }, ['categoryId']);
  rejects({ title: 'A', priority: 'low', categoryId: 4 }, {}, ['categoryId']);
});

test('validateTaskInput проверяет границы title, priority и тип completed', () => {
  const patch = (value) => validateTaskInput(value, { partial: true, categoryIds: categories });
  assert.deepEqual(patch({ title: 'А' }), { title: 'А' });
  assert.deepEqual(patch({ title: `  ${'я'.repeat(100)}  ` }), { title: 'я'.repeat(100) });
  for (const title of ['', '   ', 'я'.repeat(101), 7, null]) {
    rejects({ title }, { partial: true }, ['title']);
  }
  for (const priority of ['High', 'urgent', '', null, 1]) {
    rejects({ priority }, { partial: true }, ['priority']);
  }
  for (const completed of ['true', 1, 0, null]) {
    rejects({ completed }, { partial: true }, ['completed']);
  }
  for (const categoryId of [0, -1, 1.5, '2', 2147483648]) {
    rejects({ categoryId }, { partial: true }, ['categoryId']);
  }
});

test('validateTaskInput без Set категорий сообщает об ошибке программиста', () => {
  assert.throws(() => validateTaskInput({ title: 'A' }, { partial: true }), TypeError);
});
