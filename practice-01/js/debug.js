"use strict";

// Исправленная версия. Исходный вариант с ошибками разобран в отчёте:
// строки складывались как текст, а цикл не доходил до номера 4.

const plannedText = "8";
const completedText = "3";
const additionalText = "2";

// Исправление 1: строки переводятся в числа до сложения.
const completedTotal = Number(completedText) + Number(additionalText);
const remainingTasks = Number(plannedText) - completedTotal;

console.log("Выполнено:", completedTotal);
console.log("Осталось:", remainingTasks);

let controlSum = 0;

// Исправление 2: номер 4 тоже входит в сумму, поэтому условие нестрогое.
for (let taskNumber = 1; taskNumber <= 4; taskNumber += 1) {
  controlSum += taskNumber;
}

console.log("Контрольная сумма:", controlSum);
