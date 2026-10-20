export function getVisibleTasks(tasks, filter = "all") {
  if (filter === "pending") {
    return tasks.filter((task) => !task.completed);
  }
  if (filter === "completed") {
    return tasks.filter((task) => task.completed);
  }
  return [...tasks];
}

export function filterByPriority(tasks, priority = "all") {
  if (priority === "all") {
    return [...tasks];
  }
  return tasks.filter((task) => task.priority === priority);
}
