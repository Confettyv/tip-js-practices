import { useEffect, useRef, useState } from 'react';

// Основное задание ПР8. Реализовать эффекты и операции по контракту методички.
// api передаётся зависимостью, поэтому хук проверяется без настоящей сети.
export function useTaskData({ api, filters }) {
  const [snapshot, setSnapshot] = useState({ tasks: [], categories: [], meta: { total: 0 } });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [pending, setPending] = useState(false);
  // Счётчик обновлений: его изменение перезапускает эффект загрузки
  const [revision, setRevision] = useState(0);
  // Служебные значения без перерисовки: смонтирован ли хук и контроллер текущей мутации
  const mountedRef = useRef(false);
  const mutationRef = useRef(null);

  const { q, completed, priority, categoryId } = filters;

  useEffect(() => {
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
        const data = await api.loadInitialData({ q, completed, priority, categoryId }, { signal: controller.signal });
        if (!active) return;
        setSnapshot(data);
        setStatus('ready');
      } catch (loadError) {
        // Отменённый или устаревший запрос не меняет то, что видит пользователь
        if (!active || controller.signal.aborted) return;
        setError(loadError);
        setStatus('error');
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, q, completed, priority, categoryId, revision]);

  const refresh = () => setRevision(previous => previous + 1);

  async function mutate(operation) {
    // Блокировка через ref ставится до первого await, поэтому второй синхронный вызов сразу получает false
    if (!mountedRef.current || mutationRef.current) return false;
    const controller = new AbortController();
    mutationRef.current = controller;
    setPending(true);
    setMutationError(null);
    try {
      await operation(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return false;
      setRevision(previous => previous + 1);
      return true;
    } catch (operationError) {
      if (mountedRef.current && !controller.signal.aborted) setMutationError(operationError);
      return false;
    } finally {
      // Освобождается только своя операция; после размонтирования состояние не трогаем
      if (mutationRef.current === controller) mutationRef.current = null;
      if (mountedRef.current) setPending(false);
    }
  }

  return {
    snapshot, status, error, mutationError, pending,
    refresh,
    saveTask: (id, value) => mutate(signal => (id === null
      ? api.createTask(value, { signal })
      : api.updateTask(id, value, { signal }))),
    toggleTask: task => mutate(signal => api.setTaskCompleted(task.id, !task.completed, { signal })),
    deleteTask: id => mutate(signal => api.deleteTask(id, { signal })),
    resetData: () => mutate(signal => api.resetDemoData({ signal })),
  };
}
