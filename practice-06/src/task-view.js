export const PRIORITY_LABELS = Object.freeze({
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
});

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

// aria-label повторяет название задачи: в списке десяток кнопок «Изменить»,
// и экранный диктор должен различать, к какой карточке относится каждая.
function actionButton(action, label, taskTitle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button-secondary";
  button.dataset.action = action;
  button.setAttribute("aria-label", `${label}: ${taskTitle}`);
  button.append(textNode("span", "action-label", label));
  return button;
}

// Все строки с сервера попадают в DOM только через textContent: название
// вида <img onerror> останется текстом и не станет разметкой.
export function createTaskElement(task, category) {
  const item = document.createElement("li");
  item.className = task.completed ? "task-card is-completed" : "task-card";
  item.dataset.taskId = String(task.id);

  const meta = document.createElement("p");
  meta.className = "task-meta";
  meta.append(
    textNode("span", "task-status", task.completed ? "Выполнена" : "В работе"),
    textNode("span", "task-priority", `Приоритет: ${PRIORITY_LABELS[task.priority] ?? task.priority}`),
    textNode("span", "task-category", category?.name ?? `Категория № ${task.categoryId}`),
  );

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    actionButton("toggle", task.completed ? "Вернуть в работу" : "Отметить выполненной", task.title),
    actionButton("edit", "Изменить", task.title),
    actionButton("delete", "Удалить", task.title),
  );

  item.append(textNode("h3", "task-title", task.title), meta, actions);
  return item;
}

// replaceChildren убирает прежние карточки за одну операцию.
export function renderTaskList(list, tasks, categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  list.replaceChildren(...tasks.map((task) => createTaskElement(task, byId.get(task.categoryId))));
}
