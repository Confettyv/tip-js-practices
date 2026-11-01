"use strict";

// Исправленная версия. Исходная программа выводила
// «Выполнено: 32», «Осталось: -24», «Контрольная сумма: 6»;
// разбор ошибок — в README, раздел «Отладка».

const plannedText = "8";
const completedText = "3";
const additionalText = "2";

// Было: completedText + additionalText — склейка строк "3" + "2" = "32".
const completedTotal = Number(completedText) + Number(additionalText);
const remainingTasks = Number(plannedText) - completedTotal;

console.log("Выполнено:", completedTotal);
console.log("Осталось:", remainingTasks);

let controlSum = 0;

// Было: taskNumber < 4 — задача 4 не попадала в сумму.
for (let taskNumber = 1; taskNumber <= 4; taskNumber += 1) {
  controlSum += taskNumber;
}

console.log("Контрольная сумма:", controlSum);
