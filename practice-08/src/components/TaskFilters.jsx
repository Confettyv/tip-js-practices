export default function TaskFilters({ filters, categories, onChange }) {
  const change = event => onChange({ ...filters, [event.target.name]: event.target.value });
  return <section className="panel" aria-labelledby="filters-title"><h2 id="filters-title">Фильтры сервера</h2>
    <div className="fields">
    <div className="field"><label htmlFor="q">Поиск</label><input id="q" name="q" maxLength={100} value={filters.q} onChange={change} /></div>
    <div className="field"><label htmlFor="completed-filter">Статус</label>
    <select id="completed-filter" name="completed" value={filters.completed} onChange={change}>
      <option value="">Все</option><option value="false">В работе</option><option value="true">Выполненные</option>
    </select></div>
    <div className="field"><label htmlFor="priority-filter">Приоритет</label>
    <select id="priority-filter" name="priority" value={filters.priority} onChange={change}>
      <option value="">Все</option><option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option>
    </select></div>
    <div className="field"><label htmlFor="category-filter">Категория</label>
    <select id="category-filter" name="categoryId" value={filters.categoryId} onChange={change}>
      <option value="">Все</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select></div>
    </div>
    <button type="button" className="button button--ghost button--wide" onClick={() => onChange({ q: '', completed: '', priority: '', categoryId: '' })}>Сбросить фильтры</button>
  </section>;
}
