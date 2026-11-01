// Общий контрольный набор. Для своего варианта ниже предусмотрен отдельный массив.
// Идентификатор задачи не совпадает с её индексом в массиве.
export const demoTasks = [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];

// Вариант 1: подготовка учебного проекта. K = 0, изначально ничего не выполнено.
export const variantNumber = 1;
export const variantTasks = [
  { id: 11, title: "Согласовать тему проекта", completed: false, priority: "high" },
  { id: 23, title: "Собрать список источников", completed: false, priority: "medium" },
  { id: 37, title: "Набросать структуру отчёта", completed: false, priority: "low" },
  { id: 41, title: "Настроить репозиторий", completed: false, priority: "medium" },
  { id: 58, title: "Написать прототип", completed: false, priority: "high" },
  { id: 64, title: "Подготовить слайды защиты", completed: false, priority: "low" },
];
