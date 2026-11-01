// Расширение, вариант Б: однократная отмена последнего удаления.
// Запоминается удалённая запись и её позиция; восстановление вставляет её
// в текущий массив, поэтому изменения, сделанные после удаления, сохраняются.

export function rememberRemoval(tasks, id) {
  const index = tasks.findIndex((task) => task.id === id);
  return index === -1 ? null : { task: tasks[index], index };
}

export function restoreRemoved(tasks, removed) {
  if (removed === null) {
    return { ok: false, error: "Нечего восстанавливать." };
  }
  if (tasks.some((task) => task.id === removed.task.id)) {
    return { ok: false, error: `Задача с id ${removed.task.id} уже есть в списке.` };
  }
  const index = Math.min(removed.index, tasks.length);
  return {
    ok: true,
    tasks: [...tasks.slice(0, index), removed.task, ...tasks.slice(index)],
  };
}
