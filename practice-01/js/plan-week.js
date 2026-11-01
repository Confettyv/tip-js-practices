"use strict";

// Дополнительное задание, вариант Б: план с выходными.
// День 1 — понедельник; суббота и воскресенье — без выполнения задач.

const totalTasks = 6;
const completedTasks = 0;
const dailyLimit = 1;

const MAX_TASKS = 1000;
const MAX_LIMIT = 1000;
const dayNames = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

let error = "";

if (typeof totalTasks !== "number" || typeof completedTasks !== "number") {
  error = "количество задач должно быть числом";
} else if (!Number.isInteger(totalTasks) || !Number.isInteger(completedTasks)) {
  error = "количество задач должно быть целым числом";
} else if (totalTasks < 0 || completedTasks < 0) {
  error = "количество задач не может быть отрицательным";
} else if (totalTasks > MAX_TASKS) {
  error = `задач больше допустимых ${MAX_TASKS}`;
} else if (completedTasks > totalTasks) {
  error = "выполнено больше задач, чем существует";
} else if (typeof dailyLimit !== "number" || !Number.isInteger(dailyLimit)) {
  error = "дневная норма должна быть целым числом";
} else if (dailyLimit < 1 || dailyLimit > MAX_LIMIT) {
  error = `дневная норма должна быть от 1 до ${MAX_LIMIT}`;
}

if (error !== "") {
  console.log(`Ошибка: ${error}.`);
} else {
  let remaining = totalTasks - completedTasks;
  let calendarDays = 0;
  let workDays = 0;

  console.log(`Осталось задач: ${remaining}`);

  // Цикл заканчивается сразу после последней задачи,
  // поэтому выходные после завершения не добавляются.
  while (remaining > 0) {
    calendarDays += 1;
    const weekday = (calendarDays - 1) % 7;
    const name = dayNames[weekday];

    if (weekday >= 5) {
      console.log(`День ${calendarDays} (${name}): выходной, осталось ${remaining}`);
    } else {
      workDays += 1;
      const doneToday = Math.min(dailyLimit, remaining);
      remaining -= doneToday;
      console.log(`День ${calendarDays} (${name}): выполнено ${doneToday}, осталось ${remaining}`);
    }
  }

  console.log(`Рабочих дней: ${workDays}`);
  console.log(`Календарных дней: ${calendarDays}`);
}
