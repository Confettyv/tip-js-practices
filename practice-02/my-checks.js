import assert from "node:assert/strict";
import { demoTasks } from "./src/data.js";
import { addTask, removeTask, renameTask, setTaskCompleted, getTaskStats } from "./src/task-service.js";
import { getPrioritySummary } from "./src/task-extra.js";

function check(name, fn) {
  try {
    fn();
    console.log(`OK: ${name}`);
  } catch (error) {
    console.log(`FAIL: ${name}\n  ${error.message}`);
    process.exitCode = 1;
  }
}

check("Добавление после удаления того же id", () => {
  const removed = removeTask(demoTasks, 7);
  const added = addTask(removed.tasks, 7, "Новая задача 7", "low");
  assert.equal(added.ok, true);
  assert.deepEqual(added.tasks.map((task) => task.id), [1, 4, 10, 7]);
  assert.equal(added.tasks[3].completed, false);
});

check("Изменение первой и последней записи", () => {
  const first = renameTask(demoTasks, 1, "Первая");
  const last = setTaskCompleted(first.tasks, 10, false);
  assert.equal(last.tasks[0].title, "Первая");
  assert.equal(last.tasks[3].completed, false);
  assert.equal(demoTasks[0].title, "Изучить функции");
  assert.equal(demoTasks[3].completed, true);
});

check("Выполнить все задачи по очереди", () => {
  let tasks = demoTasks;
  for (const id of [4, 7]) {
    tasks = setTaskCompleted(tasks, id, true).tasks;
  }
  assert.equal(getTaskStats(tasks).progress, 100);
  assert.equal(getTaskStats(demoTasks).progress, 50);
});

check("Сводка по приоритетам: общий набор", () => {
  assert.deepEqual(getPrioritySummary(demoTasks), {
    low: { total: 1, pending: 1 },
    medium: { total: 2, pending: 0 },
    high: { total: 1, pending: 1 },
  });
});

check("Сводка по приоритетам: пустой список", () => {
  assert.deepEqual(getPrioritySummary([]), {
    low: { total: 0, pending: 0 },
    medium: { total: 0, pending: 0 },
    high: { total: 0, pending: 0 },
  });
});

check("Сводка по приоритетам: один приоритет", () => {
  const tasks = [
    { id: 1, title: "А", completed: true, priority: "high" },
    { id: 2, title: "Б", completed: false, priority: "high" },
  ];
  const summary = getPrioritySummary(tasks);
  assert.deepEqual(summary.high, { total: 2, pending: 1 });
  assert.deepEqual(summary.low, { total: 0, pending: 0 });
});
