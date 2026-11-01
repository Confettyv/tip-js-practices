import { useState } from 'react';
import { api, apiBaseUrl } from './config.js';
import { createInitialFilters } from './variant.js';
import { useTaskData } from './hooks/useTaskData.js';
import TaskForm from './components/TaskForm.jsx';
import TaskFilters from './components/TaskFilters.jsx';
import TaskList from './components/TaskList.jsx';

export default function App() {
  const [filters, setFilters] = useState(createInitialFilters);
  // Снимок редактируемой записи сохраняется даже при её исчезновении из выборки.
  const [editingTask, setEditingTask] = useState(null);
  const [notice, setNotice] = useState('');
  const data = useTaskData({ api, filters });
  const { tasks, categories, meta } = data.snapshot;
  const disabled = data.pending || data.status !== 'ready';
  const doneCount = tasks.filter(task => task.completed).length;

  async function save(value) {
    setNotice('');
    const saved = await data.saveTask(editingTask?.id ?? null, value);
    if (saved) { setEditingTask(null); setNotice('Сохранено на сервере. Список обновляется.'); }
    return saved;
  }
  async function toggle(task) {
    setNotice('');
    // PATCH формы не отправляет completed, поэтому черновик названия статус не перезапишет.
    if (await data.toggleTask(task)) setNotice('Статус сохранён. Список обновляется.');
  }
  async function remove(task) {
    if (!window.confirm(`Удалить «${task.title}»?`)) return;
    setNotice('');
    if (await data.deleteTask(task.id)) {
      if (editingTask?.id === task.id) setEditingTask(null);
      setNotice('Задача удалена. Список обновляется.');
    }
  }
  async function reset() {
    if (!window.confirm('Восстановить учебный набор? Текущие изменения будут потеряны.')) return;
    setNotice('');
    if (await data.resetData()) { setEditingTask(null); setNotice('Учебный набор восстановлен.'); }
  }

  return <div className="page">
    <header className="topbar">
      <div>
        <p className="topbar__eyebrow">ПР8 · React и HTTP API</p>
        <h1>Доска задач</h1>
      </div>
      <dl className="topbar__meta">
        <div><dt>Сервер</dt><dd><code>{apiBaseUrl}</code></dd></div>
        <div><dt>Хранение</dt><dd>до перезапуска API</dd></div>
      </dl>
    </header>

    <div className="layout">
      <aside className="sidebar">
        <TaskFilters filters={filters} categories={categories} onChange={setFilters} />
        {categories.length > 0 && <TaskForm key={editingTask?.id ?? 'new'} categories={categories} initialTask={editingTask} onSave={save} onCancel={() => setEditingTask(null)} disabled={disabled} />}
      </aside>

      <section className="board" aria-busy={data.status === 'loading'} aria-labelledby="board-title">
        <div className="board__head">
          <h2 id="board-title">Результат запроса</h2>
          <div className="board__tools">
            <button type="button" className="button button--ghost" onClick={data.refresh}>Обновить список</button>
            <button type="button" className="button button--ghost" disabled={disabled} onClick={reset}>Восстановить набор</button>
          </div>
        </div>

        <ul className="stats" aria-label="Сводка выборки">
          <li><span className="stats__value">{meta.total}</span> в выборке</li>
          <li><span className="stats__value">{doneCount}</span> выполнено</li>
          <li><span className="stats__value">{tasks.length - doneCount}</span> в работе</li>
        </ul>

        <p role="status" className="notice">{data.pending ? 'Сохранение…' : notice}</p>
        {data.mutationError && <p role="alert" className="banner banner--error">Изменение не подтверждено: {data.mutationError.message} При сетевой ошибке обновите список перед повтором.</p>}
        {data.status === 'loading' && <p className="banner">Загрузка… Предыдущие данные могут быть устаревшими.</p>}
        {data.status === 'error' && <p role="alert" className="banner banner--error">Не удалось обновить список: {data.error?.message} Показан последний успешный результат. Нажмите «Обновить список».</p>}
        {data.status === 'ready' && tasks.length === 0 && <p className="empty">По выбранным условиям задач нет.</p>}

        <TaskList tasks={tasks} categories={categories} disabled={disabled} editingId={editingTask?.id ?? null} onEdit={setEditingTask} onToggle={toggle} onDelete={remove} />
      </section>
    </div>
  </div>;
}
