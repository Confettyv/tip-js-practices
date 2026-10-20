const PRIORITY_LABELS = Object.freeze({
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
});

function createText(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function createButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.append(createText("span", "action-label", label));
  return button;
}

export function createTaskElement(task, category) {
  const item = document.createElement("li");
  item.className = "task-card";
  item.dataset.taskId = String(task.id);
  item.classList.toggle("is-completed", task.completed);

  const meta = document.createElement("p");
  meta.className = "task-meta";
  meta.append(
    createText("span", "task-status", task.completed ? "Выполнена" : "В работе"),
    createText("span", "task-priority", PRIORITY_LABELS[task.priority]),
    createText("span", "task-category", category?.name ?? "Без категории"),
  );

  const toggleButton = createButton("toggle", task.completed ? "Вернуть в работу" : "Выполнить");
  toggleButton.setAttribute("aria-pressed", String(task.completed));

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(toggleButton, createButton("edit", "Изменить"), createButton("delete", "Удалить"));

  item.append(createText("h3", "task-title", task.title), meta, actions);
  return item;
}

export function renderTaskList(list, tasks, categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  list.replaceChildren(...tasks.map((task) => createTaskElement(task, byId.get(task.categoryId))));
}
