import { PRIORITY_LABELS } from './labels.js';

// Карточка не копирует задачу в своё состояние: всё берётся из props,
// поэтому после любого изменения в App она показывает актуальные данные.
export default function TaskItem({ task, categoryName, isEditing = false, onToggle, onEdit, onDelete }) {
  const className = ['task', task.completed && 'is-completed', isEditing && 'is-editing', `priority-${task.priority}`]
    .filter(Boolean).join(' ');

  return (
    <li className={className}>
      <div className="task-body">
        <h3 className="task-title">{task.title}</h3>
        <p className="task-meta">
          <span className="badge badge-status">{task.completed ? 'Выполнена' : 'В работе'}</span>
          <span className="badge badge-priority">{PRIORITY_LABELS[task.priority]}</span>
          <span className="badge">{categoryName}</span>
          {isEditing && <span className="badge badge-editing">Редактируется</span>}
        </p>
      </div>
      <div className="actions">
        <button type="button" onClick={() => onToggle(task.id)} aria-label={`${task.completed ? 'Вернуть в работу' : 'Завершить'}: ${task.title}`}>
          {task.completed ? 'Вернуть в работу' : 'Завершить'}
        </button>
        <button type="button" onClick={() => onEdit(task.id)} aria-label={`Редактировать: ${task.title}`}>
          Редактировать
        </button>
        <button type="button" className="button-danger" onClick={() => onDelete(task.id)} aria-label={`Удалить: ${task.title}`}>
          Удалить
        </button>
      </div>
    </li>
  );
}
