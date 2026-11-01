import { demoTasks, variantTasks, variantNumber } from "./data.js";
import { findTaskById, setTaskCompleted, removeTask } from "./task-service.js";
import { getVisibleTasks, FILTERS } from "./task-selectors.js";
import { renderTaskList, renderSummary, renderEmptyState } from "./task-view.js";
import { rememberRemoval, restoreRemoved } from "./task-undo.js";

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
  undo: document.querySelector("#undo-delete"),
};

// Готовая служебная часть: ?dataset=variant включает данные своего варианта.
// Наборы не смешиваются, редактировать код для переключения не требуется.
const isVariant = new URLSearchParams(window.location.search).get("dataset") === "variant";
const initialTasks = isVariant ? variantTasks : demoTasks;
let currentTasks = initialTasks.map((task) => ({ ...task }));
let currentFilter = "all";
let lastRemoval = null;

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

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
  elements.undo.disabled = lastRemoval === null;
}

function showMessage(text) {
  elements.message.textContent = text;
}

// Положительное безопасное целое из строки data-task-id или null.
function parseTaskId(value) {
  if (value === undefined || value.trim() === "") {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function runAction(action, id) {
  if (action === "toggle") {
    const task = findTaskById(currentTasks, id);
    if (!task) {
      return { ok: false, error: `Задача с id ${id} не найдена.` };
    }
    return setTaskCompleted(currentTasks, id, !task.completed);
  }
  const removal = rememberRemoval(currentTasks, id);
  const result = removeTask(currentTasks, id);
  if (result.ok) {
    lastRemoval = removal;
  }
  return result;
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
  if (action !== "toggle" && action !== "delete") {
    return;
  }

  const rawId = button.closest("li[data-task-id]")?.dataset.taskId;
  const id = parseTaskId(rawId);
  if (id === null) {
    showMessage(`Некорректный идентификатор задачи: «${rawId ?? ""}».`);
    return;
  }

  const result = runAction(action, id);
  if (!result.ok) {
    showMessage(result.error);
    return;
  }
  currentTasks = result.tasks;
  showMessage("");
  renderApp();
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

function handleUndoClick() {
  const result = restoreRemoved(currentTasks, lastRemoval);
  if (!result.ok) {
    showMessage(result.error);
    return;
  }
  const { id } = lastRemoval.task;
  currentTasks = result.tasks;
  lastRemoval = null;
  showMessage("");
  renderApp();
  restoreTaskFocus(id, "delete");
}

// Готовая вспомогательная функция. Сохраняет понятную позицию клавиатурного фокуса
// после замены карточек. Если карточки больше нет, фокус получает активный фильтр.
function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

// Подписки выполняются один раз. Эти контейнеры не заменяются при перерисовке.
elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);
elements.undo.addEventListener("click", handleUndoClick);

// До реализации renderApp ожидается сообщение о заглушке.
// try/catch здесь — готовая диагностика старта, а не замена проверки result.ok.
try {
  renderApp();
} catch (error) {
  elements.message.textContent = `Ошибка запуска: ${error.message}`;
  console.error(error);
}
