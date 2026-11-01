import { demoTasks, variantTasks, variantNumber } from "./data.js";
import {
  addTask,
  findTaskById,
  removeTask,
  setTaskCompleted,
  updateTask,
} from "./task-service.js";
import { FILTERS, getVisibleTasks } from "./task-selectors.js";
import { renderEmptyState, renderSummary, renderTaskList } from "./task-view.js";
import { validateTaskDraft } from "./form-validation.js";
import { loadTasks, removeSavedTasks, saveTasks } from "./task-storage.js";

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
  storageStatus: document.querySelector("#storage-status"),
  form: document.querySelector("#task-form"),
  formHeading: document.querySelector("#form-heading"),
  formMode: document.querySelector("#form-mode"),
  formMessage: document.querySelector("#form-message"),
  idInput: document.querySelector("#task-id"),
  titleInput: document.querySelector("#task-title"),
  priorityInput: document.querySelector("#task-priority"),
  submitButton: document.querySelector("#form-submit"),
  cancelButton: document.querySelector("#cancel-edit"),
  resetButton: document.querySelector("#reset-data"),
};

const params = new URLSearchParams(window.location.search);
const isVariant = params.get("dataset") === "variant";
const isCheckRun = params.get("mode") === "check";
const initialTasks = isVariant ? variantTasks : demoTasks;
const datasetName = isVariant ? "variant" : "demo";
const storageKey = isCheckRun
  ? `tip-js-practice-04:checks:${datasetName}`
  : `tip-js-practice-04:${datasetName}`;

// Готовая граница запуска: даже незавершённый или ошибочный модуль хранилища
// не должен оставлять страницу без диагностического сообщения.
let loaded;
try {
  loaded = loadTasks(window.localStorage, storageKey, initialTasks);
} catch (error) {
  loaded = {
    ok: false,
    source: "fallback",
    tasks: initialTasks.map((task) => ({ ...task })),
    error: `Хранилище не инициализировано: ${error.message}`,
  };
  console.error(error);
}
let currentTasks = loaded.tasks;
let currentFilter = "all";
let editingId = null;

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

if (loaded.source === "storage") {
  elements.storageStatus.textContent = "Данные восстановлены из localStorage.";
} else if (loaded.ok) {
  elements.storageStatus.textContent = "Используется исходный набор; сохранённых данных пока нет.";
} else {
  elements.storageStatus.textContent = loaded.error;
  elements.storageStatus.classList.add("is-warning");
}

function renderApp() {
  const visibleTasks = getVisibleTasks(currentTasks, currentFilter);
  renderTaskList(elements.list, visibleTasks);
  renderSummary(elements.summary, currentTasks, visibleTasks.length);
  renderEmptyState(elements.empty, currentTasks.length, visibleTasks.length);

  for (const button of elements.filters.querySelectorAll("button[data-filter]")) {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function showMessage(text) {
  elements.message.textContent = text;
}

function setStorageStatus(text, isWarning = false) {
  elements.storageStatus.textContent = text;
  elements.storageStatus.classList.toggle("is-warning", isWarning);
}

// Положительное безопасное целое из строки data-task-id или null.
function parseTaskId(value) {
  if (value === undefined || value.trim() === "") {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function clearFieldError(name) {
  const input = elements.form.elements.namedItem(name);
  const message = elements.form.querySelector(`[data-error-for="${name}"]`);
  if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
  }
  if (message) message.textContent = "";
}

function clearFormErrors() {
  for (const name of ["id", "title", "priority"]) clearFieldError(name);
  elements.formMessage.textContent = "";
}

function showFormErrors(errors) {
  clearFormErrors();
  for (const [name, text] of Object.entries(errors)) {
    const input = elements.form.elements.namedItem(name);
    const message = elements.form.querySelector(`[data-error-for="${name}"]`);
    if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
      input.setCustomValidity(text);
      input.setAttribute("aria-invalid", "true");
    }
    if (message) message.textContent = text;
  }
  elements.form.reportValidity();
}

// Режим формы живёт только в памяти вкладки и в localStorage не попадает.
function setFormMode(id = null) {
  if (id === null) {
    editingId = null;
    elements.form.reset();
    clearFormErrors();
    elements.idInput.disabled = false;
    elements.formHeading.textContent = "Добавление задачи";
    elements.formMode.textContent = "Режим создания новой задачи.";
    elements.submitButton.textContent = "Добавить задачу";
    elements.cancelButton.hidden = true;
    elements.idInput.focus();
    return true;
  }

  const task = findTaskById(currentTasks, id);
  if (!task) {
    showMessage(`Задача с id ${id} не найдена.`);
    return false;
  }
  editingId = id;
  clearFormErrors();
  elements.idInput.value = String(task.id);
  elements.idInput.disabled = true;
  elements.titleInput.value = task.title;
  elements.priorityInput.value = task.priority;
  elements.formHeading.textContent = "Редактирование задачи";
  elements.formMode.textContent = `Изменяется задача ${id}. Статус выполнения не меняется.`;
  elements.submitButton.textContent = "Сохранить изменения";
  elements.cancelButton.hidden = false;
  elements.titleInput.focus();
  return true;
}

function persistCurrentTasks(successMessage) {
  const saved = saveTasks(window.localStorage, storageKey, currentTasks);
  setStorageStatus(saved.ok ? "Изменения сохранены в localStorage." : saved.error, !saved.ok);
  elements.message.textContent = saved.ok ? successMessage : `${successMessage} ${saved.error}`;
  renderApp();
  return saved;
}

// Готовая вспомогательная функция из логики ПР3. После полной перерисовки
// возвращает фокус на действие той же задачи либо на активный фильтр.
function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

function handleFormSubmit(event) {
  event.preventDefault();
  // Заблокированное поле id в FormData не попадает: при редактировании id берётся из editingId.
  const formData = new FormData(elements.form);
  const draft = {
    id: formData.get("id"),
    title: formData.get("title"),
    priority: formData.get("priority"),
  };
  const checked = validateTaskDraft(draft, currentTasks, editingId);
  if (!checked.ok) {
    showMessage("");
    showFormErrors(checked.errors);
    return;
  }

  const { id, title, priority } = checked.value;
  const isEditing = editingId !== null;
  // Сервис проверяет данные ещё раз: валидация формы не заменяет защиту операции.
  const result = isEditing
    ? updateTask(currentTasks, id, title, priority)
    : addTask(currentTasks, id, title, priority);
  if (!result.ok) {
    elements.formMessage.textContent = result.error;
    return;
  }
  currentTasks = result.tasks;
  setFormMode();
  persistCurrentTasks(isEditing ? `Задача ${id} изменена.` : `Задача ${id} добавлена.`);
}

function runAction(action, id) {
  if (action === "delete") {
    return removeTask(currentTasks, id);
  }
  const task = findTaskById(currentTasks, id);
  if (!task) {
    return { ok: false, error: `Задача с id ${id} не найдена.` };
  }
  return setTaskCompleted(currentTasks, id, !task.completed);
}

function handleTaskListClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (!button || !elements.list.contains(button)) {
    return;
  }
  const action = button.dataset.action;
  if (!["toggle", "edit", "delete"].includes(action)) {
    return;
  }

  const rawId = button.closest("li[data-task-id]")?.dataset.taskId;
  const id = parseTaskId(rawId);
  if (id === null) {
    showMessage(`Некорректный идентификатор задачи: «${rawId ?? ""}».`);
    return;
  }
  if (action === "edit") {
    if (setFormMode(id)) {
      showMessage("");
    }
    return;
  }

  const result = runAction(action, id);
  if (!result.ok) {
    showMessage(result.error);
    return;
  }
  currentTasks = result.tasks;
  if (action === "delete" && id === editingId) {
    setFormMode();
  }
  const isDone = findTaskById(currentTasks, id)?.completed;
  persistCurrentTasks(
    action === "delete"
      ? `Задача ${id} удалена.`
      : `Задача ${id}: ${isDone ? "выполнена" : "снова в работе"}.`,
  );
  restoreTaskFocus(id, action);
}

function handleFilterClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const filter = event.target.closest("button[data-filter]")?.dataset.filter;
  if (!FILTERS.includes(filter)) {
    return;
  }
  currentFilter = filter;
  showMessage("");
  renderApp();
}

// Если ключ удалить не удалось, данные не трогаются: иначе после перезагрузки
// вернулся бы старый список, а пользователь думал бы, что сброс выполнен.
function handleResetClick() {
  const removed = removeSavedTasks(window.localStorage, storageKey);
  if (!removed.ok) {
    setStorageStatus(removed.error, true);
    return;
  }
  currentTasks = initialTasks.map((task) => ({ ...task }));
  currentFilter = "all";
  setFormMode();
  setStorageStatus("Сохранённые данные удалены, показан исходный набор.");
  showMessage("");
  renderApp();
}

// Расширение Б. Событие storage приходит только в другие вкладки того же origin:
// вкладка, которая сделала запись, уже отрисовалась сама и события не получает.
function handleStorageChange(event) {
  if (event.storageArea !== window.localStorage) {
    return;
  }
  // key === null означает localStorage.clear() в другой вкладке.
  if (event.key !== null && event.key !== storageKey) {
    return;
  }

  const incoming = loadTasks(window.localStorage, storageKey, initialTasks);
  if (!incoming.ok) {
    setStorageStatus(
      "В другой вкладке записаны некорректные данные; здесь оставлен текущий список.",
      true,
    );
    return;
  }
  currentTasks = incoming.tasks;
  elements.formMessage.textContent = "";
  setStorageStatus(
    incoming.source === "storage"
      ? "Список обновлён из другой вкладки."
      : "В другой вкладке выполнен сброс; показан исходный набор.",
  );
  if (editingId !== null && !findTaskById(currentTasks, editingId)) {
    setFormMode();
    elements.formMessage.textContent = "Редактируемая задача удалена в другой вкладке.";
  }
  showMessage("");
  renderApp();
}

elements.form.addEventListener("submit", handleFormSubmit);
elements.form.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    clearFieldError(event.target.name);
  }
});
elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);
elements.cancelButton.addEventListener("click", () => setFormMode());
elements.resetButton.addEventListener("click", handleResetClick);
window.addEventListener("storage", handleStorageChange);

try {
  setFormMode();
  renderApp();
} catch (error) {
  elements.message.textContent = `Ошибка запуска: ${error.message}`;
  console.error(error);
}
