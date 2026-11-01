"use strict";

const totalTasks = 12;
const completedTasks = 5;

const MAX_TASKS = 1000;

// Проверки идут от общего к частному: сначала тип, затем само число,
// затем границы. Первая сработавшая проверка задаёт текст ошибки.
let error = "";

if (typeof totalTasks !== "number" || typeof completedTasks !== "number") {
  error = "количество задач должно быть числом, а не строкой или другим типом";
} else if (!Number.isFinite(totalTasks) || !Number.isFinite(completedTasks)) {
  error = "недопустимое числовое значение (NaN или Infinity)";
} else if (!Number.isInteger(totalTasks) || !Number.isInteger(completedTasks)) {
  error = "количество задач не может быть дробным";
} else if (totalTasks < 0 || completedTasks < 0) {
  error = "количество задач не может быть отрицательным";
} else if (totalTasks > MAX_TASKS) {
  error = `задач больше допустимых ${MAX_TASKS}`;
} else if (completedTasks > totalTasks) {
  error = "выполнено больше задач, чем существует";
}

if (error !== "") {
  console.log(`Ошибка: ${error}.`);
} else if (totalTasks === 0) {
  console.log("Задач пока нет");
} else {
  const remainingTasks = totalTasks - completedTasks;
  const percent = (completedTasks / totalTasks) * 100;

  // Статус по исходным количествам, а не по округлённому проценту:
  // при пределе 10000 задача 9999 из 10000 округлилась бы до 100.0%.
  let status = "В работе";
  if (completedTasks === 0) {
    status = "Не начато";
  } else if (completedTasks === totalTasks) {
    status = "Завершено";
  }

  console.log(`Всего задач: ${totalTasks}`);
  console.log(`Выполнено: ${completedTasks}`);
  console.log(`Осталось: ${remainingTasks}`);
  console.log(`Прогресс: ${percent.toFixed(1)}%`);
  console.log(`Статус: ${status}`);
}
