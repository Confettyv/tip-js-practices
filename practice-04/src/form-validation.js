import { findTaskById } from "./task-service.js";

const PRIORITIES = ["low", "medium", "high"];
const MAX_TITLE_LENGTH = 100;

function parseId(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function validateTaskDraft(draft, tasks, editingId = null) {
  const errors = {};
  const isEditing = editingId !== null;
  const id = isEditing ? editingId : parseId(draft.id);

  if (id === null) {
    errors.id = "Введите положительное целое число";
  } else if (isEditing && !findTaskById(tasks, id)) {
    errors.id = `Задача ${id} не найдена`;
  } else if (!isEditing && findTaskById(tasks, id)) {
    errors.id = `Задача с id ${id} уже есть`;
  }

  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  if (title.length === 0) {
    errors.title = "Введите название";
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Название длиннее ${MAX_TITLE_LENGTH} символов`;
  }

  if (!PRIORITIES.includes(draft.priority)) {
    errors.priority = "Выберите приоритет из списка";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { id, title, priority: draft.priority } };
}
