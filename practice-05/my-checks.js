import assert from "node:assert/strict";
import { createApiServer } from "./api/server.mjs";
import { ApiError, buildUrl, createApiClient } from "./src/api-client.js";
import { createTaskApi } from "./src/task-api.js";

let passed = 0;

async function check(name, action) {
  await action();
  passed += 1;
  console.log(`OK: ${name}`);
}

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
const client = createApiClient({ baseUrl, timeoutMs: 1000 });
const api = createTaskApi(client);

const task = { id: 4, title: "Подготовить модель задач", completed: false, priority: "high", categoryId: 2 };
const category = { id: 2, name: "Проект" };

function fakeApi(failTasks, failCategories) {
  return createTaskApi({
    async requestJson(path) {
      if (path === "/tasks" && failTasks) {
        throw new ApiError("Нет связи.", { kind: "network" });
      }
      if (path === "/categories" && failCategories) {
        throw new ApiError("Недоступно.", { kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" });
      }
      return path === "/tasks"
        ? { data: [task], meta: { total: 1, filters: {} } }
        : { data: [category], meta: { total: 1 } };
    },
  });
}

try {
  await check("1. вариант 1: completed=false", async () => {
    assert.equal(buildUrl(baseUrl, "/tasks", { completed: false }), `${baseUrl}/tasks?completed=false`);
    const { tasks, meta } = await api.getTasks({ completed: false });
    assert.deepEqual(tasks.map((item) => item.id), [4, 7, 13, 19, 22, 28, 34]);
    assert.equal(meta.total, 7);
  });

  await check("2. свои фильтры: низкий приоритет и не выполнена", async () => {
    const { tasks } = await api.getTasks({ priority: "low", completed: false });
    assert.deepEqual(tasks.map((item) => item.id), [7, 22]);
  });

  await check("2б. поиск с пробелом кодируется и находит задачу", async () => {
    const url = new URL(buildUrl(baseUrl, "/tasks", { q: "методы массивов" }));
    assert.equal(url.search, "?q=%D0%BC%D0%B5%D1%82%D0%BE%D0%B4%D1%8B+%D0%BC%D0%B0%D1%81%D1%81%D0%B8%D0%B2%D0%BE%D0%B2");
    const { tasks } = await api.getTasks({ q: "  методы массивов  " });
    assert.deepEqual(tasks.map((item) => item.id), [7]);
  });

  await check("3. неверное значение мимо проверки фильтров даёт http 400", async () => {
    const error = await client.requestJson("/tasks", { query: { completed: "yes" } }).catch((e) => e);
    assert.equal(error.kind, "http");
    assert.equal(error.status, 400);
    assert.equal(error.code, "INVALID_QUERY");
  });

  await check("4. несуществующая категория даёт CATEGORY_NOT_FOUND", async () => {
    const error = await client.requestJson("/categories/99").catch((e) => e);
    assert.equal(error.status, 404);
    assert.equal(error.code, "CATEGORY_NOT_FOUND");
  });

  await check("5. сигнал, отменённый до запроса, даёт aborted, а не timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await client.requestJson("/tasks", { signal: controller.signal }).catch((e) => e);
    assert.equal(error.kind, "aborted");
  });

  await check("6. поиск ровно из 100 символов проходит, из 101 нет", async () => {
    const { tasks } = await api.getTasks({ q: "я".repeat(100) });
    assert.deepEqual(tasks, []);
    await assert.rejects(() => api.getTasks({ q: "я".repeat(101) }), TypeError);
  });

  await check("7. расширение А: оба запроса успешны", async () => {
    const result = await fakeApi(false, false).loadAvailableData();
    assert.deepEqual(result.tasks, [task]);
    assert.deepEqual(result.categories, [category]);
    assert.deepEqual(result.errors, { tasks: null, categories: null });
  });

  await check("8. расширение А: задачи упали, категории остались", async () => {
    const result = await fakeApi(true, false).loadAvailableData();
    assert.equal(result.tasks, null);
    assert.equal(result.meta, null);
    assert.deepEqual(result.categories, [category]);
    assert.equal(result.errors.tasks.kind, "network");
    assert.equal(result.errors.categories, null);
  });

  await check("9. расширение А: категории упали, задачи остались", async () => {
    const result = await fakeApi(false, true).loadAvailableData();
    assert.deepEqual(result.tasks, [task]);
    assert.equal(result.categories, null);
    assert.deepEqual(result.errors.categories, {
      kind: "http",
      message: "Недоступно.",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  await check("10. расширение А: оба запроса упали, функция не бросает", async () => {
    const result = await fakeApi(true, true).loadAvailableData();
    assert.equal(result.tasks, null);
    assert.equal(result.categories, null);
    assert.equal(result.errors.tasks.kind, "network");
    assert.equal(result.errors.categories.status, 503);
  });

  console.log(`\nСвои проверки: успешно ${passed}.`);
} finally {
  server.close();
}
