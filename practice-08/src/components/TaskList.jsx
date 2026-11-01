const priorities = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };

export default function TaskList({ tasks, categories, disabled, editingId, onEdit, onToggle, onDelete }) {
  return <ul className="cards" aria-label="Задачи">{tasks.map(task => {
    const category = categories.find(c => c.id === task.categoryId)?.name ?? 'Неизвестная категория';
    const classes = ['card', `card--${task.priority}`, task.completed && 'card--done', task.id === editingId && 'card--editing'];
    return <li key={task.id} className={classes.filter(Boolean).join(' ')}>
      <div className="card__top">
        <span className="card__id">#{task.id}</span>
        <span className={`chip chip--${task.completed ? 'done' : 'open'}`}>{task.completed ? 'Выполнена' : 'В работе'}</span>
      </div>
      <h3 className="card__title">{task.title}</h3>
      <p className="card__meta">
        <span className={`priority priority--${task.priority}`}>{priorities[task.priority]}</span>
        <span>{category}</span>
      </p>
      <div className="card__actions">
        <button type="button" className="button button--small" disabled={disabled} onClick={() => onToggle(task)}>
          {task.completed ? 'Вернуть в работу' : 'Завершить'}
        </button>
        <button type="button" className="button button--small button--ghost" disabled={disabled} onClick={() => onEdit(task)}>Редактировать</button>
        <button type="button" className="button button--small button--danger" disabled={disabled} onClick={() => onDelete(task)}>Удалить</button>
      </div>
    </li>;
  })}</ul>;
}
