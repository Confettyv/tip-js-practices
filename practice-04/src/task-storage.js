export const STORAGE_VERSION = 1;

// Все функции принимают объект storage явно, чтобы их можно было проверить
// без обращения к глобальному window.localStorage. Исключения хранилища
// превращаются в { ok: false, error }.

const PRIORITIES = new Set(["low", "medium", "high"]);

// Запись проверяется как есть: при чтении ничего не исправляется.
function isValidTask(task) {
  return (
    typeof task === "object" &&
    task !== null &&
    Number.isSafeInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    task.title === task.title.trim() &&
    task.title.length >= 1 &&
    task.title.length <= 100 &&
    typeof task.completed === "boolean" &&
    PRIORITIES.has(task.priority)
  );
}

// Копируются только поля модели: лишние ключи из хранилища в приложение не попадают.
function copyTasks(tasks) {
  return tasks.map(({ id, title, completed, priority }) => ({ id, title, completed, priority }));
}

export function isValidTaskList(value) {
  if (!Array.isArray(value) || !value.every(isValidTask)) {
    return false;
  }
  return new Set(value.map((task) => task.id)).size === value.length;
}

export function loadTasks(storage, key, fallbackTasks) {
  const fallback = (error) => ({
    ok: false,
    source: "fallback",
    tasks: copyTasks(fallbackTasks),
    error: `${error} Показан исходный набор.`,
  });

  let raw;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    return fallback(`Не удалось прочитать localStorage: ${error.message}.`);
  }
  if (raw === null) {
    return { ok: true, source: "initial", tasks: copyTasks(fallbackTasks) };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback("Сохранённые данные повреждены: строка не является JSON.");
  }
  if (data?.version !== STORAGE_VERSION) {
    return fallback(`Неизвестная версия сохранённых данных: ${data?.version}.`);
  }
  if (!isValidTaskList(data.tasks)) {
    return fallback("Сохранённые задачи не прошли проверку схемы.");
  }
  return { ok: true, source: "storage", tasks: copyTasks(data.tasks) };
}

export function saveTasks(storage, key, tasks) {
  if (!isValidTaskList(tasks)) {
    return { ok: false, error: "Список задач не прошёл проверку и не сохранён." };
  }
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось сохранить в localStorage (${error.message}): после перезагрузки изменения пропадут.`,
    };
  }
}

export function removeSavedTasks(storage, key) {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Не удалось удалить сохранённые данные: ${error.message}.` };
  }
}
