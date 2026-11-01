import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

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

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Возвращает новый объект query только с заданными фильтрами. Значения
// не превращаются в строки: это делает URLSearchParams внутри buildUrl.
function normalizeFilters(filters) {
  if (!isPlainObject(filters)) {
    throw new TypeError("Фильтры должны быть обычным объектом.");
  }
  const query = {};
  for (const [key, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(key)) {
      throw new TypeError(`Неизвестный фильтр: ${key}.`);
    }
    if (value === undefined) {
      continue;
    }
    if (key === "completed" && typeof value !== "boolean") {
      throw new TypeError("completed должен быть true или false.");
    }
    if (key === "priority" && !ALLOWED_PRIORITIES.has(value)) {
      throw new TypeError("priority должен быть low, medium или high.");
    }
    if (key === "categoryId" && !isPositiveSafeInteger(value)) {
      throw new TypeError("categoryId должен быть положительным целым числом.");
    }
    if (key === "q") {
      if (typeof value !== "string" || value.trim().length > 100) {
        throw new TypeError("q должен быть строкой до 100 символов.");
      }
      query.q = value.trim();
      continue;
    }
    query[key] = value;
  }
  return query;
}

// Общая проверка ответа-коллекции: data — массив корректных элементов
// без повторов id, meta.total равен длине data.
function readCollection(payload, isItem, label) {
  if (!isPlainObject(payload) || !Array.isArray(payload.data)) {
    throw invalidResponse(`${label}: поле data должно быть массивом.`);
  }
  const badIndex = payload.data.findIndex((item) => !isItem(item));
  if (badIndex !== -1) {
    throw invalidResponse(`${label}: элемент ${badIndex} не соответствует схеме.`);
  }
  const ids = payload.data.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw invalidResponse(`${label}: в коллекции повторяются id.`);
  }
  if (!isPlainObject(payload.meta) || payload.meta.total !== payload.data.length) {
    throw invalidResponse(`${label}: meta.total не совпадает с числом элементов.`);
  }
  return payload.data;
}

// ApiError сохраняется как есть, остальные отказы описываются строкой.
function describeFailure(reason) {
  if (reason instanceof ApiError) {
    return { kind: reason.kind, status: reason.status, code: reason.code, message: reason.message };
  }
  return { kind: "unexpected", status: null, code: null, message: String(reason?.message ?? reason) };
}

// client — объект, созданный createApiClient.
// Контракт результата:
// getTasks(filters) -> Promise<{ tasks, meta }>
// getTaskById(id) -> Promise<task>
// getCategories() -> Promise<category[]>
// loadInitialData(filters) -> Promise<{ tasks, categories, meta }>
// loadInitialDataSettled(filters) -> Promise<{ tasks, categories, meta, errors }>
export function createTaskApi(client) {
  if (typeof client?.requestJson !== "function") {
    throw new TypeError("createTaskApi ожидает клиент с методом requestJson.");
  }

  // Фильтры уже проверены: функция только запрашивает и проверяет ответ.
  async function requestTasks(query) {
    const payload = await client.requestJson("/tasks", { query });
    const tasks = readCollection(payload, isTask, "Задачи");
    if (!isPlainObject(payload.meta.filters)) {
      throw invalidResponse("Задачи: meta.filters должен быть объектом.");
    }
    return { tasks, meta: payload.meta };
  }

  async function getTasks(filters = {}) {
    return requestTasks(normalizeFilters(filters));
  }

  async function getTaskById(id) {
    if (!isPositiveSafeInteger(id)) {
      throw new TypeError("id задачи должен быть положительным целым числом.");
    }
    const payload = await client.requestJson(`/tasks/${id}`);
    if (!isPlainObject(payload) || !isTask(payload.data)) {
      throw invalidResponse(`Задача ${id}: ответ не соответствует схеме.`);
    }
    return payload.data;
  }

  async function getCategories() {
    const payload = await client.requestJson("/categories");
    return readCollection(payload, isCategory, "Категории");
  }

  // Фильтры проверяются до запуска: при ошибке не уходит ни один запрос.
  // Оба запроса стартуют до общего await; отказ любого отклоняет результат.
  async function loadInitialData(filters = {}) {
    const query = normalizeFilters(filters);
    const [{ tasks, meta }, categories] = await Promise.all([
      requestTasks(query),
      getCategories(),
    ]);
    return { tasks, categories, meta };
  }

  // Расширение А. Отказ одного запроса не отменяет результат другого:
  // недоступная часть равна null, причина лежит в errors под тем же именем.
  async function loadInitialDataSettled(filters = {}) {
    const query = normalizeFilters(filters);
    const [tasksResult, categoriesResult] = await Promise.allSettled([
      requestTasks(query),
      getCategories(),
    ]);
    const errors = {};
    if (tasksResult.status === "rejected") {
      errors.tasks = describeFailure(tasksResult.reason);
    }
    if (categoriesResult.status === "rejected") {
      errors.categories = describeFailure(categoriesResult.reason);
    }
    return {
      tasks: tasksResult.status === "fulfilled" ? tasksResult.value.tasks : null,
      meta: tasksResult.status === "fulfilled" ? tasksResult.value.meta : null,
      categories: categoriesResult.status === "fulfilled" ? categoriesResult.value : null,
      errors,
    };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData, loadInitialDataSettled };
}
