"use strict";

const totalTasks = 12;
const completedTasks = 5;
const dailyLimit = 3;

// Проверки количества задач повторяют правила задания 3, к ним добавлена
// проверка дневной нормы: она обязательна даже когда выполнять уже нечего.
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
} else if (typeof dailyLimit !== "number") {
  errorMessage = "Ошибка: дневная норма должна быть числом, а не значением другого типа.";
} else if (!Number.isFinite(dailyLimit) || !Number.isInteger(dailyLimit)) {
  errorMessage = "Ошибка: дневная норма должна быть целым числом.";
} else if (dailyLimit < 1 || dailyLimit > 1000) {
  errorMessage = "Ошибка: дневная норма должна быть от 1 до 1000.";
}

if (errorMessage !== "") {
  console.log(errorMessage);
} else {
  let remainingTasks = totalTasks - completedTasks;
  let dayNumber = 0;

  console.log(`Осталось задач: ${remainingTasks}`);

  if (remainingTasks === 0) {
    console.log("Все задачи уже выполнены");
  }

  while (remainingTasks > 0) {
    dayNumber += 1;
    // В последний день нельзя выполнить больше, чем осталось.
    const tasksToday = Math.min(dailyLimit, remainingTasks);
    remainingTasks -= tasksToday;
    console.log(`День ${dayNumber}: выполнено ${tasksToday}, осталось ${remainingTasks}`);
  }

  console.log(`Потребуется дней: ${dayNumber}`);
}
