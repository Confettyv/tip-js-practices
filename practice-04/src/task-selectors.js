// Отбор задач для показа. Вход: корректный массив задач и фильтр all/pending/completed.
// Результат: новый массив, исходный порядок и объекты сохраняются.

const FILTER_TESTS = {
  all: () => true,
  pending: (task) => task.completed === false,
  completed: (task) => task.completed === true,
};

export const FILTERS = Object.keys(FILTER_TESTS);

export function getVisibleTasks(tasks, filter = "all") {
  return tasks.filter(FILTER_TESTS[filter]);
}
