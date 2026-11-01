// Операции над списком задач. Модуль ничего не выводит и не хранит состояние:
// каждая функция получает список аргументом и возвращает результат.
// Ожидаемые ошибки возвращаются как { ok: false, error }, исключений нет.

const PRIORITIES = ["low", "medium", "high"];
const TITLE_MAX_LENGTH = 100;

// Внутренние проверки: строка ошибки или null, если значение подходит.

function validateId(id) {
  if (typeof id !== "number") {
    return "Идентификатор должен быть числом.";
  }
  if (!Number.isSafeInteger(id) || id <= 0) {
    return "Идентификатор должен быть положительным целым числом.";
  }
  return null;
}

function validateTitle(title) {
  if (typeof title !== "string") {
    return "Название должно быть строкой.";
  }
  const length = title.trim().length;
  if (length === 0) {
    return "Название не может быть пустым.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `Название длиннее ${TITLE_MAX_LENGTH} символов.`;
  }
  return null;
}

function validatePriority(priority) {
  if (!PRIORITIES.includes(priority)) {
    return `Приоритет должен быть одним из: ${PRIORITIES.join(", ")}.`;
  }
  return null;
}

function fail(error) {
  return { ok: false, error };
}

// Отказ для некорректного или отсутствующего id, иначе null.
function checkExisting(tasks, id) {
  const idError = validateId(id);
  if (idError) {
    return fail(idError);
  }
  if (!findTaskById(tasks, id)) {
    return fail(`Задача с id ${id} не найдена.`);
  }
  return null;
}

// Новый массив, в котором выбранная запись заменена результатом change.
function replaceTask(tasks, id, change) {
  return (
    checkExisting(tasks, id) ?? {
      ok: true,
      tasks: tasks.map((task) => (task.id === id ? change(task) : task)),
    }
  );
}

export function createTask(id, title, priority = "medium") {
  const error =
    validateId(id) ?? validateTitle(title) ?? validatePriority(priority);
  if (error) {
    return fail(error);
  }
  return {
    ok: true,
    task: { id, title: title.trim(), completed: false, priority },
  };
}

export function findTaskById(tasks, id) {
  return tasks.find((task) => task.id === id);
}

export function getPendingTasks(tasks) {
  return tasks.filter((task) => task.completed === false);
}

export function getTaskTitles(tasks) {
  return tasks.map((task) => task.title);
}

export function getTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed === true).length;
  const progress = total > 0 ? (completed / total) * 100 : 0;
  return { total, completed, pending: total - completed, progress };
}

export function addTask(tasks, id, title, priority = "medium") {
  const created = createTask(id, title, priority);
  if (!created.ok) {
    return created;
  }
  if (findTaskById(tasks, id)) {
    return fail(`Задача с id ${id} уже существует.`);
  }
  return { ok: true, tasks: [...tasks, created.task] };
}

export function setTaskCompleted(tasks, id, completed) {
  if (typeof completed !== "boolean") {
    return fail("Статус выполнения должен быть true или false.");
  }
  return replaceTask(tasks, id, (task) => ({ ...task, completed }));
}

export function renameTask(tasks, id, title) {
  const titleError = validateTitle(title);
  if (titleError) {
    return fail(titleError);
  }
  return replaceTask(tasks, id, (task) => ({ ...task, title: title.trim() }));
}

// ПР4: меняются только title и priority, id и completed остаются прежними.
export function updateTask(tasks, id, title, priority) {
  const error = validateTitle(title) ?? validatePriority(priority);
  if (error) {
    return fail(error);
  }
  return replaceTask(tasks, id, (task) => ({ ...task, title: title.trim(), priority }));
}

export function removeTask(tasks, id) {
  return (
    checkExisting(tasks, id) ?? {
      ok: true,
      tasks: tasks.filter((task) => task.id !== id),
    }
  );
}
