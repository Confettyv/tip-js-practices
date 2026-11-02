// Собственные проверки: расширение (сортировка), выдача id и цепочка
// создание → правка → переключение → удаление на неизменяемых данных.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tasks as seed, categories } from '../src/data.js';
import { createInitialFilters } from '../src/variant.js';
import {
  addTask, getTaskStats, nextTaskId, removeTask, selectTasks, sortTasks, toggleTask, updateTask,
} from '../src/domain/task-service.js';

test('О1 nextTaskId берёт максимум, а не длину', () => {
  assert.equal(nextTaskId([]), 1);
  assert.equal(nextTaskId(seed), Math.max(...seed.map(task => task.id)) + 1);
  const gap = removeTask(seed, seed[0].id);
  assert.equal(nextTaskId(gap), nextTaskId(seed));
});

test('О2 sortTasks не меняет вход и поддерживает три режима', () => {
  const before = seed.map(task => task.id);
  const byTitle = sortTasks(seed, 'title');
  assert.deepEqual(seed.map(task => task.id), before);
  const titles = byTitle.map(task => task.title);
  assert.deepEqual(titles, [...titles].sort(new Intl.Collator('ru').compare));
  const byPriority = sortTasks(seed, 'priority-desc').map(task => task.priority);
  const rank = { high: 0, medium: 1, low: 2 };
  assert.ok(byPriority.every((p, i) => i === 0 || rank[byPriority[i - 1]] <= rank[p]));
  assert.equal(sortTasks(seed, 'none'), seed);
  assert.equal(sortTasks(seed, 'неизвестно'), seed);
});

test('О3 цепочка операций сохраняет исходный массив', () => {
  const draft = { title: 'Своя задача', priority: 'high', categoryId: categories[0].id };
  const created = addTask(seed, draft, nextTaskId(seed));
  const id = created.at(-1).id;
  const edited = updateTask(created, id, { ...draft, title: 'Своя задача, правка' });
  const toggled = toggleTask(edited, id);
  const removed = removeTask(toggled, id);
  assert.equal(created.length, seed.length + 1);
  assert.equal(edited.find(task => task.id === id).title, 'Своя задача, правка');
  assert.equal(toggled.find(task => task.id === id).completed, true);
  assert.deepEqual(removed.map(task => task.id), seed.map(task => task.id));
  assert.equal(edited[0], created[0], 'нетронутые задачи переиспользуются');
});

test('О4 вариант 1: завершение видимой задачи убирает её из выборки', () => {
  const filters = createInitialFilters();
  const visible = selectTasks(seed, filters);
  const target = visible[0];
  const after = toggleTask(seed, target.id);
  assert.ok(!selectTasks(after, filters).some(task => task.id === target.id));
  assert.equal(getTaskStats(after).completed, getTaskStats(seed).completed + 1);
});
