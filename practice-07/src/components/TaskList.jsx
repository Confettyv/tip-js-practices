import { SORT_OPTIONS } from '../domain/task-service.js';
import TaskItem from './TaskItem.jsx';

// tasks — уже отфильтрованная и отсортированная выборка. totalCount нужен,
// чтобы отличить «задач нет совсем» от «под фильтры ничего не подошло».
export default function TaskList({
  tasks, categories, totalCount = tasks.length, editingId = null,
  sort = 'none', onSortChange, onToggle, onEdit, onDelete,
}) {
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));

  return (
    <section className="panel" aria-labelledby="list-heading">
      <div className="list-header">
        <h2 id="list-heading">Задачи</h2>
        <p className="found">Найдено: <strong>{tasks.length}</strong></p>
        {onSortChange && (
          <label className="sort">
            <span>Порядок</span>
            <select value={sort} onChange={event => onSortChange(event.target.value)}>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="empty">
          {totalCount === 0
            ? 'Задач пока нет. Добавьте первую в форме выше.'
            : 'Под выбранные фильтры ничего не подходит. Измените условия или сбросьте фильтры.'}
        </p>
      ) : (
        <ul className="task-list">
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              categoryName={categoryNames.get(task.categoryId) ?? `Категория ${task.categoryId}`}
              isEditing={task.id === editingId}
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
