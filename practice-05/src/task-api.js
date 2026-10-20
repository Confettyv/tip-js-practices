import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isTask(value) {
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

function isCategory(value) {
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

function describeFailure(error) {
  return {
    kind: error instanceof ApiError ? error.kind : "unknown",
    message: error.message,
    status: error.status ?? null,
    code: error.code ?? null,
  };
}

export function createTaskApi(client) {
  if (typeof client?.requestJson !== "function") {
    throw new TypeError("Нужен клиент с методом requestJson");
  }

  async function getTasks(filters = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query });
    const tasks = checkCollection(payload, isTask, "задачи");
    return { tasks, meta: payload.meta };
  }

  async function getTaskById(id) {
    if (!isPositiveSafeInteger(id)) {
      throw new TypeError("id задачи должен быть положительным целым числом");
    }
    const payload = await client.requestJson(`/tasks/${id}`);
    if (!isTask(payload?.data)) {
      throw invalidResponse(`Сервер прислал неверную задачу ${id}`);
    }
    return payload.data;
  }

  async function getCategories() {
    const payload = await client.requestJson("/categories");
    return checkCollection(payload, isCategory, "категории");
  }

  async function loadInitialData(filters = {}) {
    const [taskResult, categories] = await Promise.all([getTasks(filters), getCategories()]);
    return { tasks: taskResult.tasks, categories, meta: taskResult.meta };
  }

  async function loadAvailableData(filters = {}) {
    const [taskResult, categoryResult] = await Promise.allSettled([
      getTasks(filters),
      getCategories(),
    ]);
    const tasksOk = taskResult.status === "fulfilled";
    const categoriesOk = categoryResult.status === "fulfilled";
    return {
      tasks: tasksOk ? taskResult.value.tasks : null,
      meta: tasksOk ? taskResult.value.meta : null,
      categories: categoriesOk ? categoryResult.value : null,
      errors: {
        tasks: tasksOk ? null : describeFailure(taskResult.reason),
        categories: categoriesOk ? null : describeFailure(categoryResult.reason),
      },
    };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData, loadAvailableData };
}
