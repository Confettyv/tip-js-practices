import { useState } from 'react';
import { validateTaskDraft } from '../domain/task-service.js';

function createDraft(task, categories) {
  if (task) {
    return { title: task.title, priority: task.priority, categoryId: String(task.categoryId) };
  }
  return { title: '', priority: 'medium', categoryId: categories.length > 0 ? String(categories[0].id) : '' };
}

export default function TaskForm({ categories, initialTask = null, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => createDraft(initialTask, categories));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const isEditing = initialTask !== null;

  const change = event => setDraft(previous => ({ ...previous, [event.target.name]: event.target.value }));

  const submit = event => {
    event.preventDefault();
    const result = validateTaskDraft(draft, categories);
    setErrors(result.errors);
    if (!result.valid) {
      setSaveError('');
      return;
    }
    if (!onSave(result.value)) {
      setSaveError('Сохранить не получилось: задача уже удалена. Черновик сохранён.');
      return;
    }
    setSaveError('');
    if (!isEditing) setDraft(createDraft(null, categories));
  };

  const fieldProps = name => ({
    id: `task-${name}`,
    name,
    value: draft[name],
    onChange: change,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `task-${name}-error` : undefined,
  });

  const error = name => errors[name] && <span className="error" id={`task-${name}-error`}>{errors[name]}</span>;

  return (
    <section aria-label="Форма задачи">
      <h2>{isEditing ? `Редактирование задачи ${initialTask.id}` : 'Новая задача'}</h2>
      <form onSubmit={submit} noValidate>
        <label htmlFor="task-title">Название</label>
        <input type="text" {...fieldProps('title')} />
        {error('title')}

        <label htmlFor="task-priority">Приоритет</label>
        <select {...fieldProps('priority')}>
          <option value="low">Низкий</option>
          <option value="medium">Средний</option>
          <option value="high">Высокий</option>
        </select>
        {error('priority')}

        <label htmlFor="task-categoryId">Категория</label>
        <select {...fieldProps('categoryId')}>
          {categories.map(category => (
            <option key={category.id} value={String(category.id)}>{category.name}</option>
          ))}
        </select>
        {error('categoryId')}

        {saveError && <p role="alert">{saveError}</p>}

        <div className="actions">
          <button type="submit">{isEditing ? 'Сохранить изменения' : 'Создать задачу'}</button>
          {isEditing && <button type="button" onClick={onCancel}>Отменить</button>}
        </div>
      </form>
    </section>
  );
}
