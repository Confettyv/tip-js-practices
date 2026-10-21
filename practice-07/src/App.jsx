import { useState } from 'react';
import { tasks as initialTasks, categories } from './data.js';
import { createInitialFilters } from './variant.js';
import { addTask, getTaskStats, removeTask, selectTasks, toggleTask, updateTask } from './domain/task-service.js';
import TaskForm from './components/TaskForm.jsx';
import TaskFilters from './components/TaskFilters.jsx';
import TaskList from './components/TaskList.jsx';
import TaskStats from './components/TaskStats.jsx';

// Следующий id — максимум полного массива + 1, для пустого массива 1
const nextId = tasks => tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;

export default function App() {
  const [tasks, setTasks] = useState(() => initialTasks.map(task => ({ ...task })));
  const [filters, setFilters] = useState(createInitialFilters);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');

  // Производные данные считаются на каждом рендере, отдельного состояния у них нет
  const visibleTasks = selectTasks(tasks, filters);
  const stats = getTaskStats(tasks);
  const editingTask = tasks.find(task => task.id === editingId) ?? null;

  const handleToggle = id => {
    const task = tasks.find(item => item.id === id);
    setTasks(previous => toggleTask(previous, id));
    if (task) setNotice(`«${task.title}»: ${task.completed ? 'возвращена в работу' : 'выполнена'}.`);
  };

  const handleDelete = id => {
    const task = tasks.find(item => item.id === id);
    if (!task || !window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setTasks(previous => removeTask(previous, id));
    if (editingId === id) setEditingId(null);
    setNotice(`Задача «${task.title}» удалена.`);
  };

  const handleSave = value => {
    if (editingId === null) {
      setTasks(previous => addTask(previous, value, nextId(previous)));
      setNotice(`Задача «${value.title}» создана.`);
      return true;
    }
    if (!editingTask) return false;
    setTasks(previous => updateTask(previous, editingId, value));
    setEditingId(null);
    setNotice(`Задача «${value.title}» сохранена.`);
    return true;
  };

  return (
    <main>
      <h1>Задачи на React</h1>
      <p>ПР7: данные в памяти. Обновление страницы восстанавливает исходный набор.</p>
      <p role="status" className="notice">{notice}</p>
      <TaskStats stats={stats} />
      <TaskFilters filters={filters} categories={categories} onChange={setFilters} />
      <TaskForm
        key={editingId ?? 'new'}
        categories={categories}
        initialTask={editingTask}
        onSave={handleSave}
        onCancel={() => setEditingId(null)}
      />
      <TaskList
        tasks={visibleTasks}
        total={tasks.length}
        categories={categories}
        onToggle={handleToggle}
        onEdit={setEditingId}
        onDelete={handleDelete}
      />
    </main>
  );
}
