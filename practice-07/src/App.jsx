import { useState } from 'react';
import { tasks as initialTasks, categories } from './data.js';
import { createInitialFilters, variant } from './variant.js';
import {
  addTask, getTaskStats, nextTaskId, removeTask, selectTasks, sortTasks, toggleTask, updateTask,
} from './domain/task-service.js';
import TaskForm from './components/TaskForm.jsx';
import TaskFilters from './components/TaskFilters.jsx';
import TaskList from './components/TaskList.jsx';
import TaskStats from './components/TaskStats.jsx';

// Состояние только здесь: задачи, фильтры, id редактируемой задачи, порядок и
// сообщение. Выборка, статистика и редактируемая задача вычисляются при рендере.
export default function App() {
  const [tasks, setTasks] = useState(() => initialTasks.map(task => ({ ...task })));
  const [filters, setFilters] = useState(createInitialFilters);
  const [editingId, setEditingId] = useState(null);
  const [sort, setSort] = useState('none');
  const [notice, setNotice] = useState('');

  const visibleTasks = sortTasks(selectTasks(tasks, filters), sort);
  const stats = getTaskStats(tasks);
  const editingTask = editingId === null ? null : tasks.find(task => task.id === editingId) ?? null;

  // Синхронный контракт: true — изменение принято, false — сохранять некуда.
  function handleSave(value) {
    if (editingId !== null) {
      if (editingTask === null) return false;
      setTasks(previous => updateTask(previous, editingId, value));
      setEditingId(null);
      setNotice(`Задача «${value.title}» сохранена.`);
      return true;
    }
    // id считается от previous внутри обновления, а не от длины или выборки.
    setTasks(previous => addTask(previous, value, nextTaskId(previous)));
    setNotice(`Задача «${value.title}» добавлена.`);
    return true;
  }

  function handleToggle(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    setTasks(previous => toggleTask(previous, id));
    setNotice(task.completed ? `«${task.title}» возвращена в работу.` : `«${task.title}» выполнена.`);
  }

  // Подтверждение до setTasks: функция обновления должна оставаться чистой,
  // а React в StrictMode вызывает её дважды.
  function handleDelete(id) {
    const task = tasks.find(item => item.id === id);
    if (!task || !window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setTasks(previous => removeTask(previous, id));
    if (editingId === id) setEditingId(null);
    setNotice(`Задача «${task.title}» удалена.`);
  }

  function handleEdit(id) {
    setEditingId(id);
    setNotice('');
  }

  function handleCancel() {
    setEditingId(null);
    setNotice('Редактирование отменено, изменения не сохранены.');
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">ТИП · ПР7 · вариант {variant}</p>
        <h1>Задачи на React</h1>
        <p className="muted">Данные хранятся в памяти страницы: после обновления вернётся исходный набор.</p>
      </header>
      <TaskStats stats={stats} />
      <TaskForm
        key={editingTask ? `edit-${editingTask.id}` : 'create'}
        categories={categories}
        initialTask={editingTask}
        onSave={handleSave}
        onCancel={handleCancel}
      />
      <p role="status" className="notice">{notice}</p>
      <TaskFilters filters={filters} categories={categories} onChange={setFilters} />
      <TaskList
        tasks={visibleTasks}
        categories={categories}
        totalCount={tasks.length}
        editingId={editingId}
        sort={sort}
        onSortChange={setSort}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </main>
  );
}
