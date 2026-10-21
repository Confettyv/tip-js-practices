export const PRIORITY_LABELS = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };

export default function TaskItem({ task, categoryName, onToggle, onEdit, onDelete }) {
  return (
    <li className={task.completed ? 'task task--done' : 'task'}>
      <h3 className="task__title">{task.title}</h3>
      <p className="task__meta">
        {task.completed ? 'Выполнена' : 'В работе'} · Приоритет: {PRIORITY_LABELS[task.priority]} · Категория: {categoryName}
      </p>
      <div className="actions">
        <button type="button" onClick={() => onToggle(task.id)}>
          {task.completed ? 'Вернуть в работу' : 'Завершить'}
        </button>
        <button type="button" onClick={() => onEdit(task.id)}>Редактировать</button>
        <button type="button" onClick={() => onDelete(task.id)}>Удалить</button>
      </div>
    </li>
  );
}
