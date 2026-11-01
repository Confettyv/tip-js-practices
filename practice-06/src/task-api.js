import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

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

// Ответ с одной задачей: { data: task }. Схема проверяется до передачи интерфейсу.
function readTask(payload, label) {
  if (!isPlainObject(payload) || !isTask(payload.data)) {
    throw invalidResponse(`${label}: ответ не соответствует схеме задачи.`);
  }
  return payload.data;
}

function checkId(id) {
  if (!isPositiveSafeInteger(id)) {
    throw new TypeError("id задачи должен быть положительным целым числом.");
  }
}

// { signal } — единственная опция, которую методы передают клиенту дальше.
function pickSignal(options) {
  if (!isPlainObject(options)) {
    throw new TypeError("Опции запроса должны быть обычным объектом.");
  }
  return options.signal === undefined ? {} : { signal: options.signal };
}

// client — объект, созданный createApiClient.
// Последний аргумент каждого метода данных — { signal }.
// getTasks(filters, options) -> Promise<{ tasks, meta }>
// getTaskById(id, options) -> Promise<task>
// getCategories(options) -> Promise<category[]>
// loadInitialData(filters, options) -> Promise<{ tasks, categories, meta }>
// loadInitialDataSettled(filters, options) -> Promise<{ tasks, categories, meta, errors }>
// createTask(draft, options) -> Promise<task>            POST /tasks
// updateTask(id, changes, options) -> Promise<task>      PATCH /tasks/:id
// setTaskCompleted(id, completed, options) -> Promise<task>
// deleteTask(id, options) -> Promise<null>               DELETE /tasks/:id, ожидается 204
// resetDemoData(options) -> Promise<{ reset, total }>    POST /debug/reset без тела
export function createTaskApi(client) {
  if (typeof client?.requestJson !== "function") {
    throw new TypeError("createTaskApi ожидает клиент с методом requestJson.");
  }

  // Фильтры уже проверены: функция только запрашивает и проверяет ответ.
  async function requestTasks(query, requestOptions) {
    const payload = await client.requestJson("/tasks", { ...requestOptions, query });
    const tasks = readCollection(payload, isTask, "Задачи");
    if (!isPlainObject(payload.meta.filters)) {
      throw invalidResponse("Задачи: meta.filters должен быть объектом.");
    }
    return { tasks, meta: payload.meta };
  }

  async function getTasks(filters = {}, options = {}) {
    return requestTasks(normalizeFilters(filters), pickSignal(options));
  }

  async function getTaskById(id, options = {}) {
    checkId(id);
    const payload = await client.requestJson(`/tasks/${id}`, pickSignal(options));
    return readTask(payload, `Задача ${id}`);
  }

  async function getCategories(options = {}) {
    const payload = await client.requestJson("/categories", pickSignal(options));
    return readCollection(payload, isCategory, "Категории");
  }

  // Фильтры проверяются до запуска: при ошибке не уходит ни один запрос.
  // Оба запроса стартуют до общего await и получают один и тот же сигнал.
  async function loadInitialData(filters = {}, options = {}) {
    const query = normalizeFilters(filters);
    const requestOptions = pickSignal(options);
    const [{ tasks, meta }, categories] = await Promise.all([
      requestTasks(query, requestOptions),
      getCategories(requestOptions),
    ]);
    return { tasks, categories, meta };
  }

  // Отказ одного запроса не отменяет результат другого: недоступная часть
  // равна null, причина лежит в errors под тем же именем.
  async function loadInitialDataSettled(filters = {}, options = {}) {
    const query = normalizeFilters(filters);
    const requestOptions = pickSignal(options);
    const [tasksResult, categoriesResult] = await Promise.allSettled([
      requestTasks(query, requestOptions),
      getCategories(requestOptions),
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

  // Черновик уже нормализован формой; окончательную проверку делает сервер (400).
  async function createTask(draft, options = {}) {
    if (!isPlainObject(draft)) {
      throw new TypeError("Черновик задачи должен быть обычным объектом.");
    }
    const payload = await client.requestJson("/tasks", {
      ...pickSignal(options),
      method: "POST",
      body: draft,
    });
    return readTask(payload, "Созданная задача");
  }

  async function updateTask(id, changes, options = {}) {
    checkId(id);
    if (!isPlainObject(changes) || Object.keys(changes).length === 0) {
      throw new TypeError("Изменения должны быть непустым объектом.");
    }
    const payload = await client.requestJson(`/tasks/${id}`, {
      ...pickSignal(options),
      method: "PATCH",
      body: changes,
    });
    return readTask(payload, `Задача ${id}`);
  }

  async function setTaskCompleted(id, completed, options = {}) {
    if (typeof completed !== "boolean") {
      throw new TypeError("completed должен быть true или false.");
    }
    return updateTask(id, { completed }, options);
  }

  // Успешное удаление — 204 без тела; клиент превращает его в null.
  async function deleteTask(id, options = {}) {
    checkId(id);
    const payload = await client.requestJson(`/tasks/${id}`, {
      ...pickSignal(options),
      method: "DELETE",
    });
    if (payload !== null) {
      throw invalidResponse(`Удаление задачи ${id}: ожидался ответ 204 без тела.`);
    }
    return null;
  }

  async function resetDemoData(options = {}) {
    const payload = await client.requestJson("/debug/reset", {
      ...pickSignal(options),
      method: "POST",
    });
    const result = payload?.data;
    if (!isPlainObject(result) || result.reset !== true || !Number.isSafeInteger(result.total)) {
      throw invalidResponse("Сброс: сервер не подтвердил восстановление данных.");
    }
    return result;
  }

  return {
    getTasks,
    getTaskById,
    getCategories,
    loadInitialData,
    loadInitialDataSettled,
    createTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    resetDemoData,
  };
}
