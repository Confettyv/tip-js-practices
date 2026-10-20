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

const API_METHODS = [
  "loadInitialData",
  "getTasks",
  "createTask",
  "updateTask",
  "setTaskCompleted",
  "deleteTask",
  "resetDemoData",
];
const VIEW_METHODS = [
  "setListState",
  "setTasks",
  "setCategories",
  "setTotal",
  "setFormTask",
  "showFormErrors",
  "setMutationPending",
  "notify",
];

function hasMethods(object, names) {
  return Boolean(object) && names.every((name) => typeof object[name] === "function");
}

export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  if (!hasMethods(api, API_METHODS) || !hasMethods(view, VIEW_METHODS)) {
    throw new TypeError("Контроллеру нужны api и view со всеми методами");
  }

  let tasks = [];
  let categories = null;
  let filters = {};
  let editingId = null;
  let loadController = null;
  let loadNumber = 0;

  async function loadTasks() {
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    loadNumber += 1;
    const current = loadNumber;
    const initial = categories === null;

    view.setListState("loading");
    try {
      const options = { signal: controller.signal };
      const result = initial
        ? await api.loadInitialData(filters, options)
        : await api.getTasks(filters, options);
      if (current !== loadNumber) {
        return;
      }

      if (initial) {
        categories = result.categories;
        view.setCategories(categories);
      }
      tasks = result.tasks;
      view.setTasks(tasks, categories);
      view.setTotal(tasks.length);
      view.setListState(tasks.length === 0 ? "empty" : "ready");
    } catch (error) {
      if (current !== loadNumber || error?.kind === "aborted") {
        return;
      }
      view.setListState("error", messageForError(error));
    } finally {
      if (loadController === controller) {
        loadController = null;
      }
    }
  }

  async function mutate(action, successMessage) {
    view.setMutationPending(true);
    try {
      await action();
      view.notify(successMessage, "success");
      await loadTasks();
      return true;
    } catch (error) {
      view.notify(messageForError(error), "error");
      return false;
    } finally {
      view.setMutationPending(false);
    }
  }

  function findTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      view.notify("Задачи нет в текущем списке. Обновите список.", "error");
    }
    return task;
  }

  function leaveEditMode() {
    editingId = null;
    view.showFormErrors({});
    view.setFormTask(null);
  }

  function start(initialFilters = {}) {
    filters = { ...initialFilters };
    return loadTasks();
  }

  function applyFilters(nextFilters = {}) {
    filters = { ...nextFilters };
    return loadTasks();
  }

  function refresh() {
    return loadTasks();
  }

  async function submit(draft) {
    const result = validateDraft(draft, categories ?? []);
    view.showFormErrors(result.errors);
    if (!result.valid) {
      return false;
    }

    const id = editingId;
    return mutate(async () => {
      if (id === null) {
        await api.createTask(result.value);
      } else {
        await api.updateTask(id, result.value);
      }
      leaveEditMode();
    }, id === null ? "Задача добавлена." : "Изменения сохранены.");
  }

  function beginEdit(id) {
    const task = findTask(id);
    if (!task) {
      return;
    }
    editingId = id;
    view.showFormErrors({});
    view.setFormTask(task);
  }

  function toggleTask(id) {
    const task = findTask(id);
    if (!task) {
      return Promise.resolve(false);
    }
    const message = task.completed ? "Задача возвращена в работу." : "Задача выполнена.";
    return mutate(() => api.setTaskCompleted(id, !task.completed), message);
  }

  function deleteTask(id) {
    return mutate(async () => {
      await api.deleteTask(id);
      if (editingId === id) {
        leaveEditMode();
      }
    }, "Задача удалена.");
  }

  function resetData() {
    return mutate(async () => {
      await api.resetDemoData();
      leaveEditMode();
    }, "Учебные данные восстановлены.");
  }

  function destroy() {
    loadController?.abort();
  }

  return {
    start,
    applyFilters,
    refresh,
    submit,
    beginEdit,
    cancelEdit: leaveEditMode,
    toggleTask,
    deleteTask,
    resetData,
    destroy,
  };
}
