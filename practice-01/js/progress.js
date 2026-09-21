"use strict";

const totalTasks = 12;
const completedTasks = 5;

// Проверка входных данных. Первое же нарушение даёт одно сообщение об ошибке,
// после которого обычная сводка не выводится.
let errorMessage = "";

if (typeof totalTasks !== "number" || typeof completedTasks !== "number") {
  errorMessage = "Ошибка: количество задач должно быть числом, а не значением другого типа.";
} else if (!Number.isFinite(totalTasks) || !Number.isFinite(completedTasks)) {
  errorMessage = "Ошибка: недопустимое числовое значение (NaN или бесконечность).";
} else if (!Number.isInteger(totalTasks) || !Number.isInteger(completedTasks)) {
  errorMessage = "Ошибка: количество задач должно быть целым числом.";
} else if (totalTasks < 0 || completedTasks < 0) {
  errorMessage = "Ошибка: количество задач не может быть отрицательным.";
} else if (totalTasks > 1000) {
  errorMessage = "Ошибка: превышена верхняя граница, допустимо не больше 1000 задач.";
} else if (completedTasks > totalTasks) {
  errorMessage = "Ошибка: выполнено больше задач, чем существует.";
}

if (errorMessage !== "") {
  console.log(errorMessage);
} else if (totalTasks === 0) {
  // Отдельная ветка до расчёта процента: деления на ноль не происходит.
  console.log("Задач пока нет");
} else {
  const remainingTasks = totalTasks - completedTasks;
  const progressPercent = (completedTasks / totalTasks) * 100;

  // Статус определяется по количествам, а не по округлённому проценту.
  let status = "";
  if (completedTasks === 0) {
    status = "Не начато";
  } else if (completedTasks < totalTasks) {
    status = "В работе";
  } else {
    status = "Завершено";
  }

  console.log(`Всего задач: ${totalTasks}`);
  console.log(`Выполнено: ${completedTasks}`);
  console.log(`Осталось: ${remainingTasks}`);
  console.log(`Прогресс: ${progressPercent.toFixed(1)}%`);
  console.log(`Статус: ${status}`);
}
