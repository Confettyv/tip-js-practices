import { useId, useState } from 'react';
import { TITLE_MAX, validateTaskDraft } from '../domain/task-service.js';
import { PRIORITY_LABELS } from './labels.js';

function createDraft(task, categories) {
  if (task) return { title: task.title, priority: task.priority, categoryId: String(task.categoryId) };
  return { title: '', priority: 'medium', categoryId: categories.length > 0 ? String(categories[0].id) : '' };
}

// Черновик живёт в форме. Начальное значение useState читается только при
// монтировании, поэтому App меняет key формы при переходе к другой задаче.
export default function TaskForm({ categories, initialTask = null, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => createDraft(initialTask, categories));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const id = useId();
  const editing = initialTask !== null;

  function change(event) {
    const { name, value } = event.target;
    setDraft(previous => ({ ...previous, [name]: value }));
    setErrors(previous => {
      if (!(name in previous)) return previous;
      const { [name]: _removed, ...rest } = previous;
      return rest;
    });
  }

  function submit(event) {
    event.preventDefault();
    const result = validateTaskDraft(draft, categories);
    setErrors(result.errors);
    setSaveError('');
    if (!result.valid) return;
    if (!onSave(result.value)) {
      setSaveError('Изменение не сохранено: задача уже удалена. Отмените редактирование.');
      return;
    }
    // В режиме правки App сам вернёт форму к созданию через смену key.
    if (!editing) setDraft(createDraft(null, categories));
  }

  const fieldProps = name => ({
    id: `${id}-${name}`,
    name,
    value: draft[name],
    onChange: change,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  });
  const errorFor = name => errors[name] && <p id={`${id}-${name}-error`} className="field-error">{errors[name]}</p>;
  const length = draft.title.trim().length;

  return (
    <section className={`panel form-panel${editing ? ' is-editing' : ''}`} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{editing ? `Редактирование задачи № ${initialTask.id}` : 'Новая задача'}</h2>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field field-wide">
            <label htmlFor={`${id}-title`}>Название</label>
            <input type="text" autoComplete="off" {...fieldProps('title')} />
            <p className={`counter${length > TITLE_MAX ? ' is-over' : ''}`} aria-hidden="true">{length}/{TITLE_MAX}</p>
            {errorFor('title')}
          </div>
          <div className="field">
            <label htmlFor={`${id}-priority`}>Приоритет</label>
            <select {...fieldProps('priority')}>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {errorFor('priority')}
          </div>
          <div className="field">
            <label htmlFor={`${id}-categoryId`}>Категория</label>
            <select {...fieldProps('categoryId')}>
              <option value="">Выберите категорию</option>
              {categories.map(category => <option key={category.id} value={String(category.id)}>{category.name}</option>)}
            </select>
            {errorFor('categoryId')}
          </div>
        </div>
        {saveError && <p role="alert" className="save-error">{saveError}</p>}
        <div className="actions">
          <button type="submit" className="button-primary">{editing ? 'Сохранить изменения' : 'Добавить задачу'}</button>
          {editing && <button type="button" onClick={onCancel}>Отменить</button>}
        </div>
      </form>
    </section>
  );
}
