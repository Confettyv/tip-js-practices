"use strict";

// Формат строки: номер, выражение, значение, тип значения.
// Предсказания и объяснения вынесены в таблицу отчёта.

const concatResult = "8" + 2;
console.log('1. "8" + 2 =', concatResult, "|", typeof concatResult);

const minusResult = "8" - 2;
console.log('2. "8" - 2 =', minusResult, "|", typeof minusResult);

const explicitSum = Number("8") + 2;
console.log('3. Number("8") + 2 =', explicitSum, "|", typeof explicitSum);

const stringCompare = "12" > "3";
console.log('4. "12" > "3" =', stringCompare, "|", typeof stringCompare);

const strictEqual = 12 === "12";
console.log('5. 12 === "12" =', strictEqual, "|", typeof strictEqual);

const emptyToNumber = Number("");
console.log('6. Number("") =', emptyToNumber, "|", typeof emptyToNumber);

const textToNumber = Number("text");
console.log('7. Number("text") =', textToNumber, "|", typeof textToNumber);

const falseText = Boolean("false");
console.log('8. Boolean("false") =', falseText, "|", typeof falseText);

// typeof сам возвращает строку: значение "object", тип результата string.
const typeofNull = typeof null;
console.log("9. typeof null =", typeofNull, "|", typeof typeofNull);

const typeofNaN = typeof NaN;
console.log("10. typeof NaN =", typeofNaN, "|", typeof typeofNaN);
