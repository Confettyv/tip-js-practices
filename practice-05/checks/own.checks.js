// Собственные проверки ПР5: случаи, которых нет в готовых наборах,
// индивидуальный вариант и расширение А. API запускается на временном порту.
import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";
import { ApiError, buildUrl, createApiClient } from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";
import { variantFilters, variantNumber } from "../src/variant.js";

let passed = 0;
let failed = 0;

async function check(name, action) {
  try {
    await action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error.stack ?? error.message);
  }
}

async function expectApiError(action, kind) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ApiError, "Ожидался экземпляр ApiError");
  assert.equal(caught.kind, kind);
  return caught;
}

const ids = (tasks) => tasks.map((task) => task.id);

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
const client = createApiClient({ baseUrl, timeoutMs: 1000 });
const api = createTaskApi(client);

try {
  await check("С1. три фильтра и поиск: невыполненные «подготов» в категории 2", async () => {
    const filters = { completed: false, categoryId: 2, q: "  подготов  " };
    const { tasks, meta } = await api.getTasks(filters);
    assert.deepEqual(ids(tasks), [4, 22]);
    assert.deepEqual(meta.filters, { completed: false, priority: null, categoryId: 2, q: "подготов" });
    assert.equal(
      buildUrl(baseUrl, "/tasks", { completed: false, categoryId: 2, q: "подготов" }),
      `${baseUrl}/tasks?completed=false&categoryId=2&q=%D0%BF%D0%BE%D0%B4%D0%B3%D0%BE%D1%82%D0%BE%D0%B2`,
    );
  });

  await check(`С2. вариант ${variantNumber}: ${JSON.stringify(variantFilters)}`, async () => {
    const { tasks, categories, meta } = await api.loadInitialData(variantFilters);
    assert.deepEqual(ids(tasks), [4, 7, 13, 19, 22, 28, 34]);
    assert.equal(meta.total, 7);
    assert.ok(tasks.every((task) => task.completed === false));
    assert.equal(categories.length, 3);
    assert.equal(buildUrl(baseUrl, "/tasks", variantFilters), `${baseUrl}/tasks?completed=false`);
  });

  await check("С3. отсутствующая категория: 404 CATEGORY_NOT_FOUND с деталями", async () => {
    const error = await expectApiError(() => client.requestJson("/categories/999"), "http");
    assert.equal(error.status, 404);
    assert.equal(error.code, "CATEGORY_NOT_FOUND");
    assert.deepEqual(error.details, { id: 999 });
    assert.equal(error.url, `${baseUrl}/categories/999`);
  });

  await check("С4. строка вместо логического значения в обход task-api: 400 INVALID_QUERY", async () => {
    const error = await expectApiError(
      () => client.requestJson("/tasks", { query: { completed: "yes" } }),
      "http",
    );
    assert.equal(error.status, 400);
    assert.equal(error.code, "INVALID_QUERY");
  });

  await check("С5. уже отменённый сигнал: aborted, fetchFn получает отменённый сигнал", async () => {
    let received;
    const fake = createApiClient({
      baseUrl,
      fetchFn: async (_url, { signal }) => {
        received = signal;
        throw signal.reason;
      },
    });
    const error = await expectApiError(
      () => fake.requestJson("/tasks", { signal: AbortSignal.abort() }),
      "aborted",
    );
    assert.equal(received.aborted, true);
    assert.equal(error.cause.name, "AbortError");
  });

  await check("С6. отмена позже тайм-аута: побеждает тот сигнал, что сработал первым", async () => {
    const controller = new AbortController();
    const pending = client.requestJson("/debug/delay", {
      query: { ms: 300 },
      signal: controller.signal,
      timeoutMs: 30,
    });
    setTimeout(() => controller.abort(), 100);
    await expectApiError(() => pending, "timeout");
  });

  await check("С7. q на границе: 100 символов после trim проходят, 101 — нет", async () => {
    const calls = [];
    const fakeApi = createTaskApi({
      async requestJson(path, options) {
        calls.push(options.query.q.length);
        return { data: [], meta: { total: 0, filters: {} } };
      },
    });
    await fakeApi.getTasks({ q: ` ${"я".repeat(100)} ` });
    await assert.rejects(() => fakeApi.getTasks({ q: "я".repeat(101) }), TypeError);
    assert.deepEqual(calls, [100]);
  });

  await check("С8. схема: задача без categoryId и meta без filters отклоняются", async () => {
    const { categoryId, ...withoutCategory } = { id: 4, title: "Задача", completed: false, priority: "low", categoryId: 2 };
    void categoryId;
    const noCategory = createTaskApi({
      async requestJson() {
        return { data: [withoutCategory], meta: { total: 1, filters: {} } };
      },
    });
    const error = await expectApiError(() => noCategory.getTasks(), "invalid-response");
    assert.match(error.message, /элемент 0/);

    const noFilters = createTaskApi({
      async requestJson() {
        return { data: [], meta: { total: 0 } };
      },
    });
    await expectApiError(() => noFilters.getTasks(), "invalid-response");
  });

  await check("С9. неверный фильтр в loadInitialData: ни одного запроса", async () => {
    let calls = 0;
    const fakeApi = createTaskApi({
      async requestJson() {
        calls += 1;
        return {};
      },
    });
    await assert.rejects(() => fakeApi.loadInitialData({ priority: "urgent" }), TypeError);
    assert.equal(calls, 0);
  });

  await check("С10. путь с .. не выходит за пределы baseUrl", () => {
    assert.throws(() => buildUrl(baseUrl, "../health"), TypeError);
    assert.throws(() => buildUrl(baseUrl, "tasks?x=1"), TypeError);
    assert.throws(() => buildUrl(baseUrl, "http://evil.test/api"), TypeError);
  });

  // Расширение А: loadInitialDataSettled. Отказ подставляется на нужный путь.
  function settledApi(failures) {
    return createTaskApi({
      requestJson(path, options) {
        if (failures[path]) {
          return Promise.reject(failures[path]);
        }
        return client.requestJson(path, options);
      },
    });
  }
  const down = new ApiError("Сервер недоступен: ответ не получен.", { kind: "network" });
  const busy = new ApiError("Сервис временно недоступен.", { kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" });

  await check("А1. оба запроса успешны: errors пуст", async () => {
    const result = await settledApi({}).loadInitialDataSettled({ priority: "high" });
    assert.deepEqual(ids(result.tasks), [4, 13, 16, 25, 34]);
    assert.equal(result.meta.total, 5);
    assert.equal(result.categories.length, 3);
    assert.deepEqual(result.errors, {});
  });

  await check("А2. задачи упали, категории сохранены", async () => {
    const result = await settledApi({ "/tasks": busy }).loadInitialDataSettled();
    assert.equal(result.tasks, null);
    assert.equal(result.meta, null);
    assert.equal(result.categories.length, 3);
    assert.deepEqual(result.errors, {
      tasks: { kind: "http", status: 503, code: "SERVICE_UNAVAILABLE", message: "Сервис временно недоступен." },
    });
  });

  await check("А3. категории упали, задачи сохранены", async () => {
    const result = await settledApi({ "/categories": down }).loadInitialDataSettled({ completed: true });
    assert.deepEqual(ids(result.tasks), [1, 10, 16, 25, 31]);
    assert.equal(result.categories, null);
    assert.equal(result.errors.categories.kind, "network");
    assert.equal("tasks" in result.errors, false);
  });

  await check("А4. оба упали: обе причины, данные null, Promise не отклонён", async () => {
    const result = await settledApi({ "/tasks": down, "/categories": busy }).loadInitialDataSettled();
    assert.deepEqual(
      [result.tasks, result.categories, result.meta],
      [null, null, null],
    );
    assert.deepEqual(Object.keys(result.errors), ["tasks", "categories"]);
    assert.equal(result.errors.categories.status, 503);
  });

  await check("А5. ошибка схемы в категориях попадает в errors как invalid-response", async () => {
    const fakeApi = createTaskApi({
      async requestJson(path, options) {
        if (path === "/categories") {
          return { data: [{ id: 1, name: "" }], meta: { total: 1 } };
        }
        return client.requestJson(path, options);
      },
    });
    const result = await fakeApi.loadInitialDataSettled();
    assert.equal(result.tasks.length, 12);
    assert.equal(result.errors.categories.kind, "invalid-response");
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`\nИтог собственных проверок: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
