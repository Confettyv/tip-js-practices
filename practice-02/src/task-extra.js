// Расширение, вариант А: поиск по части названия без учёта регистра.

export function searchTasks(tasks, query) {
  const needle = query.trim().toLowerCase();
  return tasks.filter((task) => task.title.toLowerCase().includes(needle));
}
