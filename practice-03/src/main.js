import { demoTasks, variantTasks, variantNumber } from "./data.js";
import { findTaskById, setTaskCompleted, removeTask } from "./task-service.js";
import { getVisibleTasks, filterByPriority } from "./task-selectors.js";
import { renderTaskList, renderSummary, renderEmptyState } from "./task-view.js";

const FILTERS = ["all", "pending", "completed"];
const PRIORITY_FILTERS = ["all", "low", "medium", "high"];

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  priorityFilters: document.querySelector("#priority-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
};

const isVariant = new URLSearchParams(window.location.search).get("dataset") === "variant";
const initialTasks = isVariant ? variantTasks : demoTasks;
let currentTasks = initialTasks.map((task) => ({ ...task }));
let currentFilter = "all";
let currentPriority = "all";

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

function markActive(container, attribute, value) {
  for (const button of container.querySelectorAll(`[${attribute}]`)) {
    const active = button.getAttribute(attribute) === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function renderApp() {
  const byStatus = getVisibleTasks(currentTasks, currentFilter);
  const visibleTasks = filterByPriority(byStatus, currentPriority);

  renderTaskList(elements.list, visibleTasks);
  renderSummary(elements.summary, currentTasks, visibleTasks.length);
  renderEmptyState(elements.empty, currentTasks.length, visibleTasks.length);
  markActive(elements.filters, "data-filter", currentFilter);
  markActive(elements.priorityFilters, "data-priority", currentPriority);
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

  const card = button.closest("li[data-task-id]");
  const id = Number(card?.dataset.taskId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    elements.message.textContent = "Неверный id задачи";
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
  } else {
    result = removeTask(currentTasks, id);
  }

  if (!result.ok) {
    elements.message.textContent = result.error;
    return;
  }

  currentTasks = result.tasks;
  elements.message.textContent = "";
  renderApp();
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

function handlePriorityClick(event) {
  const button = event.target instanceof Element ? event.target.closest("button[data-priority]") : null;
  if (!button || !PRIORITY_FILTERS.includes(button.dataset.priority)) {
    return;
  }

  currentPriority = button.dataset.priority;
  elements.message.textContent = "";
  renderApp();
}

function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);
elements.priorityFilters.addEventListener("click", handlePriorityClick);

renderApp();
