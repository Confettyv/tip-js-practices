import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) return "Не удалось выполнить операцию.";
  if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  if (error.kind === "network") return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  if (error.kind === "invalid-response") return "Сервер вернул ответ неожиданного формата.";
  if (error.kind === "http" && error.status === 404) return "Запись уже отсутствует на сервере. Обновите список.";
  if (error.kind === "http") return error.message || `Сервер вернул ошибку ${error.status}.`;
  return "Не удалось выполнить операцию.";
}

const VIEW_METHODS = [
  "setListState", "setTasks", "setCategories", "setTotal", "setFormTask",
  "showFormErrors", "setMutationPending", "notify",
];
const API_METHODS = [
  "loadInitialData", "getTasks", "createTask", "updateTask",
  "setTaskCompleted", "deleteTask", "resetDemoData",
];

function requireMethods(target, names, label) {
  const missing = names.filter((name) => typeof target?.[name] !== "function");
  if (missing.length > 0) {
    throw new TypeError(`${label}: нет методов ${missing.join(", ")}.`);
  }
}

function isAborted(error) {
  return error instanceof ApiError && error.kind === "aborted";
}

// view — адаптер из dom-app.js. Контроллер не обращается к document,
// поэтому в проверках его можно запустить с поддельными api и view.
// Методы результата: start, applyFilters, refresh, submit, beginEdit,
// cancelEdit, toggleTask, deleteTask, resetData и destroy.
export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  requireMethods(api, API_METHODS, "api");
  requireMethods(view, VIEW_METHODS, "view");
  if (typeof validateDraft !== "function") {
    throw new TypeError("validateDraft должен быть функцией.");
  }

  const state = {
    tasks: [],
    categories: null, // null — категории ещё ни разу не пришли
    filters: {},
    editingId: null,
    loadController: null,
    loadSeq: 0,
    mutating: false,
    destroyed: false,
  };

  function showTasks(tasks, total) {
    state.tasks = tasks;
    view.setTasks(tasks, state.categories);
    view.setTotal(total);
    view.setListState(tasks.length === 0 ? "empty" : "ready");
  }

  // Каждая загрузка отменяет предыдущую и получает свой номер. abort() рвёт
  // сетевой запрос, а номер отсекает ответ, который уже успел прийти:
  // после await применяется только результат последней начатой загрузки.
  // Пока категорий нет, загрузка снова идёт через loadInitialData.
  async function loadTasks() {
    state.loadController?.abort();
    const controller = new AbortController();
    const seq = ++state.loadSeq;
    state.loadController = controller;
    const isCurrent = () => !state.destroyed && seq === state.loadSeq;
    const options = { signal: controller.signal };

    view.setListState("loading");
    try {
      if (state.categories === null) {
        const { tasks, categories, meta } = await api.loadInitialData(state.filters, options);
        if (!isCurrent()) return;
        state.categories = categories;
        view.setCategories(categories);
        showTasks(tasks, meta.total);
      } else {
        const { tasks, meta } = await api.getTasks(state.filters, options);
        if (!isCurrent()) return;
        showTasks(tasks, meta.total);
      }
    } catch (error) {
      if (!isCurrent() || isAborted(error)) return;
      view.setListState("error", messageForError(error));
    } finally {
      if (seq === state.loadSeq) state.loadController = null;
    }
  }

  function leaveEditMode() {
    state.editingId = null;
    view.setFormTask(null);
    view.showFormErrors({});
  }

  // Общая схема мутации: блокировка, запрос, сообщение, повторный GET.
  // Повторный клик во время ожидания игнорируется, чтобы не создать дубль.
  // Сервер — источник истины: список берётся заново, а не правится локально.
  async function runMutation(operation, successMessage) {
    if (state.mutating || state.destroyed) return false;
    state.mutating = true;
    view.setMutationPending(true);
    try {
      await operation();
      view.notify(successMessage, "success");
      await loadTasks();
      return true;
    } catch (error) {
      view.notify(messageForError(error), "error");
      // 404: запись удалили в другой вкладке — список на экране устарел.
      if (error instanceof ApiError && error.kind === "http" && error.status === 404) {
        if (state.editingId !== null) leaveEditMode();
        await loadTasks();
      }
      return false;
    } finally {
      state.mutating = false;
      if (!state.destroyed) view.setMutationPending(false);
    }
  }

  function findTask(id) {
    return state.tasks.find((task) => task.id === id) ?? null;
  }

  async function start(filters = {}) {
    state.filters = { ...filters };
    await loadTasks();
  }

  async function applyFilters(filters = {}) {
    state.filters = { ...filters };
    await loadTasks();
  }

  async function refresh() {
    await loadTasks();
  }

  async function submit(draft) {
    const { valid, value, errors } = validateDraft(draft, state.categories ?? []);
    view.showFormErrors(errors);
    if (!valid) return;

    const editingId = state.editingId;
    if (editingId === null) {
      const ok = await runMutation(() => api.createTask(value), `Задача «${value.title}» добавлена.`);
      if (ok) view.setFormTask(null);
      return;
    }
    // completed не отправляется: сервер сохранит текущий статус задачи.
    const ok = await runMutation(() => api.updateTask(editingId, value), `Задача № ${editingId} сохранена.`);
    if (ok) leaveEditMode();
  }

  function beginEdit(id) {
    const task = findTask(id);
    if (!task) {
      view.notify("Задача не найдена в текущем списке. Обновите список.", "error");
      return;
    }
    state.editingId = id;
    view.showFormErrors({});
    view.setFormTask(task);
  }

  function cancelEdit() {
    leaveEditMode();
  }

  async function toggleTask(id) {
    const task = findTask(id);
    if (!task) {
      view.notify("Задача не найдена в текущем списке. Обновите список.", "error");
      return;
    }
    const next = !task.completed;
    await runMutation(
      () => api.setTaskCompleted(id, next),
      next ? `Задача № ${id} отмечена выполненной.` : `Задача № ${id} возвращена в работу.`,
    );
  }

  async function deleteTask(id) {
    const ok = await runMutation(() => api.deleteTask(id), `Задача № ${id} удалена.`);
    if (ok && state.editingId === id) leaveEditMode();
  }

  async function resetData() {
    const ok = await runMutation(() => api.resetDemoData(), "Учебные данные восстановлены.");
    if (ok && state.editingId !== null) leaveEditMode();
  }

  // После destroy ни один ответ не меняет интерфейс.
  function destroy() {
    state.destroyed = true;
    state.loadController?.abort();
    state.loadController = null;
  }

  return {
    start,
    applyFilters,
    refresh,
    submit,
    beginEdit,
    cancelEdit,
    toggleTask,
    deleteTask,
    resetData,
    destroy,
  };
}
