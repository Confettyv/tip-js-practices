import { useCallback, useEffect, useRef, useState } from 'react';

const emptySnapshot = { tasks: [], categories: [], meta: { total: 0 } };

// api передаётся зависимостью, поэтому хук проверяется без настоящей сети.
export function useTaskData({ api, filters }) {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [pending, setPending] = useState(false);
  // Счётчик обновлений: его изменение и только оно перезапускает загрузку без смены фильтров
  const [revision, setRevision] = useState(0);
  // Контроллер текущей мутации: одновременно служит блокировкой повторного вызова
  const mutationRef = useRef(null);
  const mountedRef = useRef(false);

  // Примитивы вместо объекта filters: новый объект с теми же значениями не вызовет лишний GET
  const { q, completed, priority, categoryId } = filters;

  useEffect(() => {
    // setup ставит true заново: StrictMode выполняет setup → cleanup → setup
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    async function load() {
      try {
        const next = await api.loadInitialData({ q, completed, priority, categoryId }, { signal: controller.signal });
        if (!active) return;
        setSnapshot(next);
        setStatus('ready');
      } catch (loadError) {
        // Отменённый или устаревший запрос не должен затирать свежий результат
        if (!active || controller.signal.aborted) return;
        setError(loadError);
        setStatus('error');
      }
    }
    void load();

    // Сначала запрещаем запись результата, потом отменяем: порядок закрывает и тот случай,
    // когда реализация API игнорирует signal
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, q, completed, priority, categoryId, revision]);

  const refresh = useCallback(() => setRevision(value => value + 1), []);

  const mutate = useCallback(async (operation) => {
    if (!mountedRef.current || mutationRef.current) return false;
    const controller = new AbortController();
    // ref ставится до первого await: второй синхронный вызов уже увидит блокировку
    mutationRef.current = controller;
    setPending(true);
    setMutationError(null);
    try {
      await operation(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return false;
      // Новый GET запустит эффект с фильтрами, актуальными на момент окончания записи
      setRevision(value => value + 1);
      return true;
    } catch (mutationFailure) {
      if (mountedRef.current && !controller.signal.aborted) setMutationError(mutationFailure);
      return false;
    } finally {
      // Освобождаем только свою операцию, чужую ссылку не трогаем
      if (mutationRef.current === controller) {
        mutationRef.current = null;
        if (mountedRef.current) setPending(false);
      }
    }
  }, []);

  const saveTask = useCallback((id, value) => mutate(signal => (id === null
    ? api.createTask(value, { signal })
    : api.updateTask(id, value, { signal }))), [api, mutate]);
  const toggleTask = useCallback(task => mutate(signal => api.setTaskCompleted(task.id, !task.completed, { signal })), [api, mutate]);
  const deleteTask = useCallback(id => mutate(signal => api.deleteTask(id, { signal })), [api, mutate]);
  const resetData = useCallback(() => mutate(signal => api.resetDemoData({ signal })), [api, mutate]);

  return { snapshot, status, error, mutationError, pending, refresh, saveTask, toggleTask, deleteTask, resetData };
}
