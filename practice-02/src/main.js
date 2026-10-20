import { demoTasks, variantNumber, variantTasks } from "./data.js";
import {
  createTask,
  findTaskById,
  getPendingTasks,
  getTaskTitles,
  getTaskStats,
  addTask,
  setTaskCompleted,
  renameTask,
  removeTask,
} from "./task-service.js";
import { getPrioritySummary } from "./task-extra.js";

function printStats(tasks) {
  const { total, completed, pending, progress } = getTaskStats(tasks);
  console.log(`Всего: ${total}; выполнено: ${completed}; осталось: ${pending}`);
  if (total === 0) {
    console.log("Задач пока нет");
  } else {
    console.log(`Прогресс: ${progress.toFixed(1)}%`);
  }
}

function step(title, tasks, result) {
  console.log(`\n${title}`);
  if (!result.ok) {
    console.log(`Ошибка: ${result.error}`);
    printStats(tasks);
    return tasks;
  }
  console.log("id:", result.tasks.map((task) => task.id).join(", "));
  printStats(result.tasks);
  return result.tasks;
}

console.log("=== Общий набор ===");
console.table(demoTasks);
console.log("Названия:", getTaskTitles(demoTasks));
console.log("Невыполненные id:", getPendingTasks(demoTasks).map((task) => task.id).join(", "));
console.log("Поиск id 4:", findTaskById(demoTasks, 4));
console.log("Создание задачи:", createTask(20, "  Проверить  данные  ", "high"));
printStats(demoTasks);

let tasks = demoTasks;
tasks = step("Добавление id 20", tasks, addTask(tasks, 20, "Добавить проверку", "high"));
tasks = step("Выполнение id 4", tasks, setTaskCompleted(tasks, 4, true));
tasks = step("Переименование id 10", tasks, renameTask(tasks, 10, "Подготовить инструкцию запуска"));
tasks = step("Удаление id 7", tasks, removeTask(tasks, 7));
tasks = step("Повторное добавление id 20", tasks, addTask(tasks, 20, "Повтор", "low"));
tasks = step("Статус строкой \"true\"", tasks, setTaskCompleted(tasks, 1, "true"));

console.log("\nИтоговый список:");
console.table(tasks);
console.log("Исходный demoTasks после сценария:");
console.table(demoTasks);

console.log(`\n=== Вариант ${variantNumber} ===`);
console.table(variantTasks);
printStats(variantTasks);

let variant = variantTasks;
variant = step("Добавление id 80", variant, addTask(variant, 80, "Распределить роли в команде", "high"));
variant = step("Выполнение id 11", variant, setTaskCompleted(variant, 11, true));
variant = step("Переименование id 23", variant, renameTask(variant, 23, "Собрать команду из трёх человек"));
variant = step("Удаление id 37", variant, removeTask(variant, 37));
variant = step("Повторное добавление id 80", variant, addTask(variant, 80, "Повтор", "low"));

console.log("\nИтоговый список варианта:");
console.table(variant);
console.log("Исходный variantTasks после сценария:");
console.table(variantTasks);

console.log("\n=== Сводка по приоритетам (расширение) ===");
console.log("demoTasks:", getPrioritySummary(demoTasks));
console.log("Вариант после сценария:", getPrioritySummary(variant));
