import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

export function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

const FILTER_CHECKS = {
  completed: (value) => typeof value === "boolean",
  priority: (value) => ALLOWED_PRIORITIES.has(value),
  categoryId: isPositiveSafeInteger,
  q: (value) => typeof value === "string" && value.trim().length <= 100,
};

function normalizeFilters(filters) {
  if (filters === null || typeof filters !== "object" || Array.isArray(filters)) {
    throw new TypeError("Фильтры должны быть объектом");
  }

  const query = {};
  for (const [name, value] of Object.entries(filters)) {
    if (!Object.hasOwn(FILTER_CHECKS, name)) {
      throw new TypeError(`Неизвестный фильтр: ${name}`);
    }
    if (value === undefined) {
      continue;
    }
    if (!FILTER_CHECKS[name](value)) {
      throw new TypeError(`Недопустимое значение фильтра ${name}`);
    }
    query[name] = name === "q" ? value.trim() : value;
  }
  return query;
}

function checkId(id) {
  if (!isPositiveSafeInteger(id)) {
    throw new TypeError("id задачи должен быть положительным целым числом");
  }
}

function hasUniqueIds(items) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function checkCollection(payload, isItem, name) {
  const items = payload?.data;
  if (!Array.isArray(items) || !items.every(isItem) || !hasUniqueIds(items)) {
    throw invalidResponse(`Сервер прислал неверный список: ${name}`);
  }
  if (payload.meta?.total !== items.length) {
    throw invalidResponse(`meta.total не совпадает с числом элементов: ${name}`);
  }
  return items;
}

function checkTask(payload) {
  if (!isTask(payload?.data)) {
    throw invalidResponse("Сервер прислал неверную задачу");
  }
  return payload.data;
}

export function createTaskApi(client) {
  if (typeof client?.requestJson !== "function") {
    throw new TypeError("Нужен клиент с методом requestJson");
  }

  async function getTasks(filters = {}, { signal } = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query, signal });
    const tasks = checkCollection(payload, isTask, "задачи");
    return { tasks, meta: payload.meta };
  }

  async function getTaskById(id, { signal } = {}) {
    checkId(id);
    return checkTask(await client.requestJson(`/tasks/${id}`, { signal }));
  }

  async function getCategories({ signal } = {}) {
    const payload = await client.requestJson("/categories", { signal });
    return checkCollection(payload, isCategory, "категории");
  }

  async function loadInitialData(filters = {}, options = {}) {
    const [taskResult, categories] = await Promise.all([
      getTasks(filters, options),
      getCategories(options),
    ]);
    return { tasks: taskResult.tasks, categories, meta: taskResult.meta };
  }

  async function createTask(draft, { signal } = {}) {
    return checkTask(await client.requestJson("/tasks", { method: "POST", body: draft, signal }));
  }

  async function updateTask(id, changes, { signal } = {}) {
    checkId(id);
    return checkTask(await client.requestJson(`/tasks/${id}`, { method: "PATCH", body: changes, signal }));
  }

  async function setTaskCompleted(id, completed, { signal } = {}) {
    checkId(id);
    if (typeof completed !== "boolean") {
      throw new TypeError("completed должен быть true или false");
    }
    const body = { completed };
    return checkTask(await client.requestJson(`/tasks/${id}`, { method: "PATCH", body, signal }));
  }

  async function deleteTask(id, { signal } = {}) {
    checkId(id);
    const payload = await client.requestJson(`/tasks/${id}`, { method: "DELETE", signal });
    if (payload !== null) {
      throw invalidResponse("После удаления сервер должен вернуть пустой ответ 204");
    }
    return null;
  }

  async function resetDemoData({ signal } = {}) {
    const payload = await client.requestJson("/debug/reset", { method: "POST", signal });
    if (payload?.data?.reset !== true || !Number.isSafeInteger(payload.data.total)) {
      throw invalidResponse("Сервер не подтвердил восстановление данных");
    }
    return payload.data;
  }

  return {
    getTasks,
    getTaskById,
    getCategories,
    loadInitialData,
    createTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    resetDemoData,
  };
}
