import TaskItem from './TaskItem.jsx';

export default function TaskList({ tasks, categories, onToggle, onEdit, onDelete, total = tasks.length }) {
  const categoryName = id => categories.find(category => category.id === id)?.name ?? 'Без категории';

  return (
    <section aria-label="Список задач">
      <h2>Задачи</h2>
      <p>Найдено: {tasks.length}</p>
      {tasks.length === 0 ? (
        <p className="empty">
          {total === 0 ? 'Задач пока нет. Создайте первую в форме выше.' : 'Нет задач, подходящих под выбранные фильтры.'}
        </p>
      ) : (
        <ul>
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              categoryName={categoryName(task.categoryId)}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
