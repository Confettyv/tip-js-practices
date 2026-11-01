// Собственные случаи и проверки расширения. Готовый checks.js не менялся.
import assert from "node:assert/strict";
import {
  addTask,
  setTaskCompleted,
  renameTask,
  removeTask,
  getTaskStats,
} from "./src/task-service.js";
import { searchTasks } from "./src/task-extra.js";

let failed = 0;

function check(name, action) {
  try {
    action();
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}\n${error.message}`);
  }
}

function fixture() {
  return [
    { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
    { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
    { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
    { id: 10, title: "Оформить README", completed: true, priority: "medium" },
  ];
}

const ids = (tasks) => tasks.map((task) => task.id);

check("С1. id освобождается после удаления и снова доступен", () => {
  const removed = removeTask(fixture(), 7);
  const added = addTask(removed.tasks, 7, "Вернуть задачу", "low");
  assert.equal(added.ok, true);
  assert.deepEqual(ids(added.tasks), [1, 4, 10, 7]);
  assert.deepEqual(ids(removed.tasks), [1, 4, 10]);
});

check("С2. Изменение первой и последней записи не трогает середину", () => {
  const start = fixture();
  const first = setTaskCompleted(start, 1, false);
  const last = renameTask(first.tasks, 10, "Финальный README");
  assert.deepEqual(
    last.tasks.map((task) => [task.id, task.completed, task.title]),
    [
      [1, false, "Изучить функции"],
      [4, false, "Подготовить модель задач"],
      [7, false, "Проверить методы массивов"],
      [10, true, "Финальный README"],
    ],
  );
  assert.equal(last.tasks[1], start[1]);
  assert.equal(last.tasks[2], start[2]);
  assert.notEqual(last.tasks[0], start[0]);
});

check("С3. Каждое промежуточное состояние цепочки сохраняется", () => {
  const s0 = fixture();
  const s1 = addTask(s0, 20, "Новая", "high").tasks;
  const s2 = setTaskCompleted(s1, 20, true).tasks;
  const s3 = removeTask(s2, 1).tasks;
  assert.deepEqual(
    [s0, s1, s2, s3].map((state) => getTaskStats(state).completed),
    [2, 2, 3, 2],
  );
  assert.equal(s1.at(-1).completed, false);
  assert.deepEqual(s0, fixture());
});

check("С4. Длина названия считается после trim", () => {
  const exact = `  ${"я".repeat(100)}  `;
  const result = addTask([], 3, exact);
  assert.equal(result.ok, true);
  assert.equal(result.tasks[0].title.length, 100);
  assert.equal(addTask([], 3, "я".repeat(101)).ok, false);
});

check("С5. Отказ переименования оставляет запись и массив прежними", () => {
  const start = fixture();
  const result = renameTask(start, 4, "   ");
  assert.equal(result.ok, false);
  assert.equal(typeof result.error, "string");
  assert.deepEqual(start, fixture());
});

check("А1. Поиск без учёта регистра и краевых пробелов", () => {
  assert.deepEqual(ids(searchTasks(fixture(), " ФУНК ")), [1]);
  assert.deepEqual(ids(searchTasks(fixture(), "ПОДГОТОВИТЬ")), [4]);
  assert.deepEqual(ids(searchTasks(fixture(), "ть")), [1, 4, 7, 10]);
});

check("А2. Нет совпадений и пустой список дают []", () => {
  assert.deepEqual(searchTasks(fixture(), "несуществующий фрагмент"), []);
  assert.deepEqual(searchTasks([], "задача"), []);
});

check("А3. Пустой запрос возвращает новый массив всех задач", () => {
  const start = fixture();
  const result = searchTasks(start, "   ");
  assert.deepEqual(result, start);
  assert.notEqual(result, start);
});

check("А4. Поиск не меняет записи", () => {
  const start = fixture();
  searchTasks(start, "README");
  assert.deepEqual(start, fixture());
});

console.log(failed === 0 ? "\nВсе собственные проверки пройдены." : `\nНе пройдено: ${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
