const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const TITLE_MAX = 100;

// Возвращает { valid, value, errors } и не меняет draft.
// value содержит нормализованные title, priority и числовой categoryId;
// при ошибке value всё равно заполнен тем, что удалось разобрать.
export function validateTaskDraft(draft, categories) {
  const source = draft && typeof draft === "object" ? draft : {};
  const knownIds = new Set(Array.isArray(categories) ? categories.map((category) => category.id) : []);
  const errors = {};

  const title = typeof source.title === "string" ? source.title.trim() : "";
  if (title.length === 0) {
    errors.title = "Введите название задачи.";
  } else if (title.length > TITLE_MAX) {
    errors.title = `Название длиннее ${TITLE_MAX} символов: сейчас ${title.length}.`;
  }

  const priority = source.priority;
  if (!ALLOWED_PRIORITIES.has(priority)) {
    errors.priority = "Выберите приоритет из списка.";
  }

  // Поле select отдаёт строку: "" означает «не выбрано», а не категорию 0.
  const rawCategory = source.categoryId;
  const categoryId = rawCategory === "" || rawCategory == null ? Number.NaN : Number(rawCategory);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    errors.categoryId = "Выберите категорию.";
  } else if (!knownIds.has(categoryId)) {
    errors.categoryId = "Такой категории нет среди загруженных.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    value: { title, priority, categoryId },
    errors,
  };
}
