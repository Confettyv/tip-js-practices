import { getTaskStats } from "./task-service.js";

const PRIORITY_LABELS = { low: "Низкий", medium: "Средний", high: "Высокий" };

function createButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;

  const span = document.createElement("span");
  span.className = "action-label";
  span.textContent = label;
  button.append(span);
  return button;
}

export function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-card";
  item.dataset.taskId = String(task.id);
  if (task.completed) {
    item.classList.add("is-completed");
  }

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  const status = document.createElement("p");
  status.className = "task-status";
  status.textContent = task.completed ? "Выполнена" : "В работе";

  const priority = document.createElement("p");
  priority.className = "task-priority";
  priority.textContent = PRIORITY_LABELS[task.priority];

  const toggleButton = createButton("toggle", "Выполнена");
  toggleButton.setAttribute("aria-pressed", String(task.completed));
  const deleteButton = createButton("delete", "Удалить");

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(toggleButton, deleteButton);

  item.append(title, status, priority, actions);
  return item;
}

export function renderTaskList(listElement, tasks) {
  const cards = tasks.map(createTaskElement);
  listElement.replaceChildren(...cards);
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

  for (const [name, value] of Object.entries(values)) {
    summaryElement.querySelector(`[data-stat="${name}"]`).textContent = String(value);
  }
}

export function renderEmptyState(messageElement, total, visibleCount) {
  if (visibleCount > 0) {
    messageElement.textContent = "";
    messageElement.hidden = true;
    return;
  }

  messageElement.textContent = total === 0 ? "Список задач пуст." : "Нет задач по выбранному фильтру.";
  messageElement.hidden = false;
}
