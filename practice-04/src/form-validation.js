const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const TITLE_MAX_LENGTH = 100;

// Чистая проверка данных формы. DOM и показ сообщений выполняются в main.js.
// Каждая проверка возвращает текст ошибки или null.

// Значение поля формы приходит строкой. Пустая строка не должна стать нулём.
function toId(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return Number.NaN;
  }
  return Number(value);
}

function checkId(id, tasks, isEditing) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return isEditing
      ? "Некорректный идентификатор редактируемой задачи."
      : "Введите положительное целое число.";
  }
  const exists = tasks.some((task) => task.id === id);
  if (isEditing && !exists) {
    return `Задача с id ${id} больше не существует.`;
  }
  if (!isEditing && exists) {
    return `Задача с id ${id} уже существует.`;
  }
  return null;
}

function checkTitle(title) {
  if (typeof title !== "string") {
    return "Введите название.";
  }
  const length = title.trim().length;
  if (length === 0) {
    return "Название не может состоять только из пробелов.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `Название длиннее ${TITLE_MAX_LENGTH} символов.`;
  }
  return null;
}

function checkPriority(priority) {
  return ALLOWED_PRIORITIES.has(priority) ? null : "Выберите низкий, средний или высокий приоритет.";
}

// draft: { id, title, priority }; editingId: null либо id редактируемой задачи.
// В режиме редактирования draft.id не читается: поле заблокировано.
export function validateTaskDraft(draft, tasks, editingId = null) {
  const isEditing = editingId !== null;
  const id = isEditing ? editingId : toId(draft.id);
  const checks = {
    id: checkId(id, tasks, isEditing),
    title: checkTitle(draft.title),
    priority: checkPriority(draft.priority),
  };
  const errors = Object.fromEntries(
    Object.entries(checks).filter(([, message]) => message !== null),
  );
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { id, title: draft.title.trim(), priority: draft.priority } };
}
