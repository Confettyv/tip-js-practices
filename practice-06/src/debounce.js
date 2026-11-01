// Дополнительное задание 2. Вызов fn откладывается на delayMs после последнего
// вызова обёртки: пока пользователь печатает, запросы не уходят.
// cancel() снимает отложенный вызов, flush() выполняет его немедленно.
export function debounce(fn, delayMs) {
  if (typeof fn !== "function") {
    throw new TypeError("debounce ожидает функцию.");
  }
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) {
    throw new TypeError("delayMs должен быть неотрицательным целым числом.");
  }
  let timer = null;
  let lastArgs = [];

  function debounced(...args) {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, delayMs);
  }
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  debounced.flush = () => {
    if (timer === null) return;
    debounced.cancel();
    fn(...lastArgs);
  };
  debounced.pending = () => timer !== null;
  return debounced;
}
