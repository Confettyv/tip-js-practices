import { demoTasks, variantTasks, variantNumber } from "./data.js";
import {
  addTask,
  findTaskById,
  removeTask,
  setTaskCompleted,
  updateTask,
} from "./task-service.js";
import { getVisibleTasks } from "./task-selectors.js";
import { renderEmptyState, renderSummary, renderTaskList } from "./task-view.js";
import { validateTaskDraft } from "./form-validation.js";
import { loadTasks, removeSavedTasks, saveTasks } from "./task-storage.js";

const FILTERS = ["all", "pending", "completed"];

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

const loaded = loadTasks(window.localStorage, storageKey, initialTasks);
let currentTasks = loaded.tasks;
let currentFilter = "all";
let editingId = null;

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

function showLoadStatus(result, restoredText, initialText) {
  elements.storageStatus.classList.toggle("is-warning", !result.ok);
  if (!result.ok) {
    elements.storageStatus.textContent = result.error;
  } else if (result.source === "storage") {
    elements.storageStatus.textContent = restoredText;
  } else {
    elements.storageStatus.textContent = initialText;
  }
}

function markActive(container, attribute, value) {
  for (const button of container.querySelectorAll(`[${attribute}]`)) {
    const active = button.getAttribute(attribute) === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function renderApp() {
  const visibleTasks = getVisibleTasks(currentTasks, currentFilter);
  renderTaskList(elements.list, visibleTasks);
  renderSummary(elements.summary, currentTasks, visibleTasks.length);
  renderEmptyState(elements.empty, currentTasks.length, visibleTasks.length);
  markActive(elements.filters, "data-filter", currentFilter);
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
    return true;
  }

  const task = findTaskById(currentTasks, id);
  if (!task) {
    elements.message.textContent = `Задача ${id} не найдена`;
    return false;
  }

  editingId = task.id;
  clearFormErrors();
  elements.idInput.value = String(task.id);
  elements.idInput.disabled = true;
  elements.titleInput.value = task.title;
  elements.priorityInput.value = task.priority;
  elements.formHeading.textContent = "Редактирование задачи";
  elements.formMode.textContent = `Изменяется задача ${task.id}. Идентификатор менять нельзя.`;
  elements.submitButton.textContent = "Сохранить изменения";
  elements.cancelButton.hidden = false;
  elements.titleInput.focus();
  return true;
}

function persistCurrentTasks(successMessage) {
  const saved = saveTasks(window.localStorage, storageKey, currentTasks);
  elements.storageStatus.classList.toggle("is-warning", !saved.ok);
  elements.storageStatus.textContent = saved.ok
    ? "Изменения сохранены в localStorage."
    : saved.error;
  elements.message.textContent = saved.ok ? successMessage : `${successMessage} ${saved.error}`;
  renderApp();
  return saved;
}

function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const draft = {
    id: formData.get("id"),
    title: formData.get("title"),
    priority: formData.get("priority"),
  };

  const checked = validateTaskDraft(draft, currentTasks, editingId);
  if (!checked.ok) {
    showFormErrors(checked.errors);
    elements.formMessage.textContent = "Исправьте отмеченные поля.";
    elements.message.textContent = "";
    return;
  }

  const { id, title, priority } = checked.value;
  const isEditing = editingId !== null;
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

function handleTaskListClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button || !elements.list.contains(button)) {
    return;
  }

  const action = button.dataset.action;
  const card = button.closest("li[data-task-id]");
  const id = Number(card?.dataset.taskId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    elements.message.textContent = "Неверный id задачи";
    return;
  }

  if (action === "edit") {
    setFormMode(id);
    return;
  }

  let result;
  if (action === "toggle") {
    const task = findTaskById(currentTasks, id);
    if (!task) {
      elements.message.textContent = `Задача ${id} не найдена`;
      return;
    }
    result = setTaskCompleted(currentTasks, id, !task.completed);
  } else if (action === "delete") {
    result = removeTask(currentTasks, id);
  } else {
    return;
  }

  if (!result.ok) {
    elements.message.textContent = result.error;
    return;
  }

  currentTasks = result.tasks;
  if (action === "delete" && editingId === id) {
    setFormMode();
  }
  const done = action === "toggle" ? `Статус задачи ${id} изменён.` : `Задача ${id} удалена.`;
  persistCurrentTasks(done);
  restoreTaskFocus(id, action);
}

function handleFilterClick(event) {
  const button = event.target instanceof Element ? event.target.closest("button[data-filter]") : null;
  if (!button || !FILTERS.includes(button.dataset.filter)) {
    return;
  }

  currentFilter = button.dataset.filter;
  elements.message.textContent = "";
  renderApp();
}

function handleResetClick() {
  const removed = removeSavedTasks(window.localStorage, storageKey);
  currentTasks = initialTasks.map((task) => ({ ...task }));
  currentFilter = "all";
  setFormMode();
  renderApp();

  elements.storageStatus.classList.toggle("is-warning", !removed.ok);
  elements.storageStatus.textContent = removed.ok
    ? "Сохранённые данные удалены, показан исходный набор."
    : removed.error;
  elements.message.textContent = removed.ok ? "Данные сброшены." : "";
}

function handleStorageChange(event) {
  if (event.storageArea !== window.localStorage) {
    return;
  }
  if (event.key !== storageKey && event.key !== null) {
    return;
  }

  const result = loadTasks(window.localStorage, storageKey, initialTasks);
  currentTasks = result.tasks;
  if (editingId !== null && !findTaskById(currentTasks, editingId)) {
    setFormMode();
  }
  showLoadStatus(
    result,
    "Список обновлён из другой вкладки.",
    "В другой вкладке данные сброшены, показан исходный набор.",
  );
  elements.message.textContent = "";
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

setFormMode();
showLoadStatus(
  loaded,
  "Данные восстановлены из localStorage.",
  "Используется исходный набор; сохранённых данных пока нет.",
);
renderApp();
