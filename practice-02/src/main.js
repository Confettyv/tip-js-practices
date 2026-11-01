import { demoTasks, variantNumber, variantTasks } from "./data.js";
import {
  findTaskById,
  getPendingTasks,
  getTaskTitles,
  getTaskStats,
  addTask,
  setTaskCompleted,
  renameTask,
  removeTask,
} from "./task-service.js";
import { searchTasks } from "./task-extra.js";

function formatStats(tasks) {
  const { total, completed, pending, progress } = getTaskStats(tasks);
  const shown = total === 0 ? "Задач пока нет" : `${progress.toFixed(1)}%`;
  return `всего ${total}, выполнено ${completed}, осталось ${pending}, прогресс ${shown}`;
}

function formatIds(tasks) {
  return `[${tasks.map((task) => task.id).join(", ")}]`;
}

// Сценарий хранит текущий список в замыкании. Успешная операция заменяет его,
// отказ печатается и список не трогает.
function createScenario(title, initialTasks) {
  let current = initialTasks;
  console.log(`\n=== ${title} ===`);
  console.table(initialTasks);
  console.log(`Названия: ${getTaskTitles(initialTasks).join("; ")}`);
  console.log(`Не выполнены: ${formatIds(getPendingTasks(initialTasks))}`);
  console.log(`Исходно: ${formatStats(initialTasks)}`);

  return {
    apply(label, result) {
      if (result.ok) {
        current = result.tasks;
        console.log(`${label}: ${formatStats(current)}`);
      } else {
        console.log(`${label}: отказ «${result.error}», список не изменён ${formatIds(current)}`);
      }
    },
    get tasks() {
      return current;
    },
  };
}

function snapshot(tasks) {
  return JSON.stringify(tasks);
}

// Общий сценарий (раздел 6.5)

const demoBefore = snapshot(demoTasks);
const demo = createScenario("Общий набор", demoTasks);

demo.apply("Добавлена id 20", addTask(demo.tasks, 20, "Добавить проверку", "high"));
demo.apply("Выполнена id 4", setTaskCompleted(demo.tasks, 4, true));
demo.apply("Переименована id 10", renameTask(demo.tasks, 10, "Подготовить инструкцию запуска"));
demo.apply("Удалена id 7", removeTask(demo.tasks, 7));
demo.apply("Повтор id 20", addTask(demo.tasks, 20, "Дубликат", "low"));
demo.apply("Статус строкой", setTaskCompleted(demo.tasks, 1, "false"));
demo.apply("Удаление id 777", removeTask(demo.tasks, 777));

console.log(`Итоговые id: ${formatIds(demo.tasks)}, не выполнены: ${formatIds(getPendingTasks(demo.tasks))}`);
console.log(`id 10 теперь: «${findTaskById(demo.tasks, 10).title}»`);
console.log(`demoTasks не изменён: ${snapshot(demoTasks) === demoBefore}`);

// Индивидуальный вариант (раздел 7)

const variantBefore = snapshot(variantTasks);
const variant = createScenario(`Вариант ${variantNumber}`, variantTasks);

variant.apply("Добавлена id 80", addTask(variant.tasks, 80, "Отправить работу на проверку", "high"));
variant.apply("Выполнена id 11", setTaskCompleted(variant.tasks, 11, true));
variant.apply("Переименована id 23", renameTask(variant.tasks, 23, "  Отобрать пять источников  "));
variant.apply("Удалена id 37", removeTask(variant.tasks, 37));
variant.apply("Повтор id 80", addTask(variant.tasks, 80, "Ещё раз", "high"));

console.table(variant.tasks);
console.log(`Итоговые id: ${formatIds(variant.tasks)}`);
console.log(`variantTasks не изменён: ${snapshot(variantTasks) === variantBefore}`);

// Расширение: поиск

console.log("\n=== Поиск по названию ===");
for (const query of [" ФУНК ", "проверить", "несуществующий фрагмент", "   "]) {
  console.log(`«${query}» → ${formatIds(searchTasks(demoTasks, query))}`);
}
