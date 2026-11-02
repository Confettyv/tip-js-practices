import { PRIORITY_LABELS } from './labels.js';

export const EMPTY_FILTERS = Object.freeze({ q: '', completed: '', priority: '', categoryId: '' });

// Все четыре поля управляемые: значение берётся из filters, изменение
// уходит родителю целым новым объектом.
export default function TaskFilters({ filters, categories, onChange }) {
  const change = event => onChange({ ...filters, [event.target.name]: event.target.value });
  const active = Object.values(filters).some(value => value !== '');

  return (
    <section className="panel" aria-labelledby="filters-heading">
      <h2 id="filters-heading">Фильтры</h2>
      <div className="filters">
        <label className="field field-wide">
          <span>Поиск по названию</span>
          <input type="search" name="q" value={filters.q} onChange={change} placeholder="Например, провер" />
        </label>
        <label className="field">
          <span>Статус</span>
          <select name="completed" value={filters.completed} onChange={change}>
            <option value="">Любой</option>
            <option value="false">В работе</option>
            <option value="true">Выполненные</option>
          </select>
        </label>
        <label className="field">
          <span>Приоритет</span>
          <select name="priority" value={filters.priority} onChange={change}>
            <option value="">Любой</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Категория</span>
          <select name="categoryId" value={filters.categoryId} onChange={change}>
            <option value="">Любая</option>
            {categories.map(category => <option key={category.id} value={String(category.id)}>{category.name}</option>)}
          </select>
        </label>
      </div>
      <button type="button" className="button-quiet" onClick={() => onChange({ ...EMPTY_FILTERS })} disabled={!active}>
        Сбросить фильтры
      </button>
    </section>
  );
}
