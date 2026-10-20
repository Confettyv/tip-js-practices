const PRIORITIES = ["low", "medium", "high"];
const MAX_TITLE_LENGTH = 100;

function isValidId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

function checkTitle(title) {
  if (typeof title !== "string") {
    return "Название должно быть строкой";
  }

  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return "Название не может быть пустым";
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return `Название длиннее ${MAX_TITLE_LENGTH} символов`;
  }
  return null;
}

function fail(error) {
  return { ok: false, error };
}

export function createTask(id, title, priority = "medium") {
  if (!isValidId(id)) {
    return fail("id должен быть положительным целым числом");
  }

  const titleError = checkTitle(title);
  if (titleError) {
    return fail(titleError);
  }

  if (!PRIORITIES.includes(priority)) {
    return fail("Приоритет должен быть low, medium или high");
  }

  const task = { id, title: title.trim(), completed: false, priority };
  return { ok: true, task };
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
  const pending = total - completed;
  const progress = total === 0 ? 0 : (completed / total) * 100;

  return { total, completed, pending, progress };
}

export function addTask(tasks, id, title, priority = "medium") {
  if (findTaskById(tasks, id)) {
    return fail(`Задача с id ${id} уже есть`);
  }

  const result = createTask(id, title, priority);
  if (!result.ok) {
    return result;
  }

  return { ok: true, tasks: [...tasks, result.task] };
}

export function setTaskCompleted(tasks, id, completed) {
  if (!isValidId(id)) {
    return fail("Неверный id");
  }
  if (typeof completed !== "boolean") {
    return fail("Статус должен быть true или false");
  }
  if (!findTaskById(tasks, id)) {
    return fail(`Задача ${id} не найдена`);
  }

  const updated = tasks.map((task) => (task.id === id ? { ...task, completed } : task));
  return { ok: true, tasks: updated };
}

export function renameTask(tasks, id, title) {
  if (!isValidId(id)) {
    return fail("Неверный id");
  }

  const titleError = checkTitle(title);
  if (titleError) {
    return fail(titleError);
  }

  if (!findTaskById(tasks, id)) {
    return fail(`Задача ${id} не найдена`);
  }

  const newTitle = title.trim();
  const updated = tasks.map((task) => (task.id === id ? { ...task, title: newTitle } : task));
  return { ok: true, tasks: updated };
}

export function updateTask(tasks, id, title, priority) {
  if (!isValidId(id)) {
    return fail("Неверный id");
  }
  if (!findTaskById(tasks, id)) {
    return fail(`Задача ${id} не найдена`);
  }

  const titleError = checkTitle(title);
  if (titleError) {
    return fail(titleError);
  }
  if (!PRIORITIES.includes(priority)) {
    return fail("Приоритет должен быть low, medium или high");
  }

  const newTitle = title.trim();
  const updated = tasks.map((task) =>
    task.id === id ? { ...task, title: newTitle, priority } : task,
  );
  return { ok: true, tasks: updated };
}

export function removeTask(tasks, id) {
  if (!isValidId(id)) {
    return fail("Неверный id");
  }
  if (!findTaskById(tasks, id)) {
    return fail(`Задача ${id} не найдена`);
  }

  return { ok: true, tasks: tasks.filter((task) => task.id !== id) };
}
