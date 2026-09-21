"use strict";

// Дополнительное задание, вариант Б: план с выходными днями.
// Первый календарный день — понедельник, суббота и воскресенье не рабочие,
// дневная норма действует только в рабочие дни.

const totalTasks = 6;
const completedTasks = 0;
const dailyLimit = 1;

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
  let calendarDays = 0;
  let workingDays = 0;

  console.log(`Осталось задач: ${remainingTasks}`);

  if (remainingTasks === 0) {
    console.log("Все задачи уже выполнены");
  }

  // Цикл заканчивается сразу после последней задачи, поэтому хвостовые
  // выходные в расписание не попадают.
  while (remainingTasks > 0) {
    calendarDays += 1;

    // 1 — понедельник, ..., 6 — суббота, 7 — воскресенье.
    const weekdayNumber = ((calendarDays - 1) % 7) + 1;
    const isWeekend = weekdayNumber === 6 || weekdayNumber === 7;

    let weekdayName = "";
    if (weekdayNumber === 1) {
      weekdayName = "понедельник";
    } else if (weekdayNumber === 2) {
      weekdayName = "вторник";
    } else if (weekdayNumber === 3) {
      weekdayName = "среда";
    } else if (weekdayNumber === 4) {
      weekdayName = "четверг";
    } else if (weekdayNumber === 5) {
      weekdayName = "пятница";
    } else if (weekdayNumber === 6) {
      weekdayName = "суббота";
    } else {
      weekdayName = "воскресенье";
    }

    if (isWeekend) {
      console.log(`День ${calendarDays} (${weekdayName}): выходной, осталось ${remainingTasks}`);
    } else {
      const tasksToday = Math.min(dailyLimit, remainingTasks);
      remainingTasks -= tasksToday;
      workingDays += 1;
      console.log(`День ${calendarDays} (${weekdayName}): выполнено ${tasksToday}, осталось ${remainingTasks}`);
    }
  }

  console.log(`Рабочих дней с выполнением задач: ${workingDays}`);
  console.log(`Календарных дней до завершения: ${calendarDays}`);
}
