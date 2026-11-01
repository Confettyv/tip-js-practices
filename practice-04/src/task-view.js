import { getTaskStats } from "./task-service.js";

// Здесь создаётся DOM, но не изменяется состояние приложения.

const PRIORITY_LABELS = { low: "Низкий", medium: "Средний", high: "Высокий" };

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createActionButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.append(createElement("span", "action-label", label));
  return button;
}

export function createTaskElement(task) {
  const card = createElement("li", "task-card");
  card.dataset.taskId = String(task.id);
  card.classList.toggle("is-completed", task.completed);

  const toggle = createActionButton("toggle", "Выполнена");
  toggle.setAttribute("aria-pressed", String(task.completed));

  const actions = createElement("div", "task-actions");
  actions.append(
    toggle,
    createActionButton("edit", "Изменить"),
    createActionButton("delete", "Удалить"),
  );

  card.append(
    createElement("h3", "task-title", task.title),
    createElement("span", "task-status", task.completed ? "Выполнена" : "В работе"),
    createElement("span", "task-priority", PRIORITY_LABELS[task.priority]),
    actions,
  );
  return card;
}

export function renderTaskList(listElement, tasks) {
  listElement.replaceChildren(...tasks.map(createTaskElement));
}

export function renderSummary(summaryElement, tasks, visibleCount) {
  const { total, completed, pending, progress } = getTaskStats(tasks);
  const values = {
    total,
    completed,
    pending,
    progress: `${progress.toFixed(1)}%`,
    visible: visibleCount,
  };
  for (const [stat, value] of Object.entries(values)) {
    summaryElement.querySelector(`[data-stat="${stat}"]`).textContent = String(value);
  }
}

export function renderEmptyState(messageElement, total, visibleCount) {
  let text = "";
  if (visibleCount === 0) {
    text = total === 0 ? "Список задач пуст." : "Нет задач по выбранному фильтру.";
  }
  messageElement.textContent = text;
  messageElement.hidden = text === "";
}
