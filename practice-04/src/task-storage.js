export const STORAGE_VERSION = 1;

const PRIORITIES = ["low", "medium", "high"];

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isSafeInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    task.title.length <= 100 &&
    typeof task.completed === "boolean" &&
    PRIORITIES.includes(task.priority)
  );
}

function copyTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

export function isValidTaskList(value) {
  if (!Array.isArray(value) || !value.every(isValidTask)) {
    return false;
  }
  const ids = new Set(value.map((task) => task.id));
  return ids.size === value.length;
}

export function loadTasks(storage, key, fallbackTasks) {
  const fallback = (error) => ({
    ok: false,
    source: "fallback",
    tasks: copyTasks(fallbackTasks),
    error,
  });

  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback("Не удалось прочитать localStorage, показан исходный набор.");
  }

  if (raw === null) {
    return { ok: true, source: "initial", tasks: copyTasks(fallbackTasks) };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback("Сохранённые данные повреждены, показан исходный набор.");
  }

  if (data?.version !== STORAGE_VERSION) {
    return fallback("Неизвестная версия сохранённых данных, показан исходный набор.");
  }
  if (!isValidTaskList(data.tasks)) {
    return fallback("Сохранённые задачи имеют неверный формат, показан исходный набор.");
  }

  return { ok: true, source: "storage", tasks: copyTasks(data.tasks) };
}

export function saveTasks(storage, key, tasks) {
  if (!isValidTaskList(tasks)) {
    return { ok: false, error: "Список задач некорректен и не сохранён." };
  }
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить изменения в localStorage." };
  }
}

export function removeSavedTasks(storage, key) {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось удалить сохранённые данные." };
  }
}
