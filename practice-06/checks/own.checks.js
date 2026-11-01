// Собственные проверки ПР6: вариант 1, граничные случаи контроллера и debounce.
import assert from "node:assert/strict";
import { ApiError, createApiClient } from "../src/api-client.js";
import { createAppController } from "../src/app-controller.js";
import { debounce } from "../src/debounce.js";
import { validateTaskDraft } from "../src/form-validation.js";
import { createTaskApi } from "../src/task-api.js";
import { getVariantFilters, variantNumber } from "../src/variant.js";

let passed = 0;
let failed = 0;

async function check(name, action) {
  try {
    await action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL: ${name}\n  ${error.message}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CATEGORIES = [{ id: 1, name: "Учёба" }, { id: 2, name: "Проект" }];

function task(overrides = {}) {
  return { id: 4, title: "Задача", completed: false, priority: "high", categoryId: 2, ...overrides };
}

function viewDouble() {
  const log = { states: [], tasks: [], formTasks: [], errors: [], pending: [], notices: [] };
  return {
    log,
    setListState: (...args) => log.states.push(args),
    setTasks: (tasks) => log.tasks.push(tasks),
    setCategories() {},
    setTotal() {},
    setFormTask: (value) => log.formTasks.push(value),
    showFormErrors: (value) => log.errors.push(value),
    setMutationPending: (value) => log.pending.push(value),
    notify: (...args) => log.notices.push(args),
  };
}

// Простейший «сервер» в памяти: getTasks честно фильтрует по completed.
function memoryApi(initial) {
  const rows = initial.map((item) => ({ ...item }));
  const select = (filters) => rows.filter((item) => filters.completed === undefined || item.completed === filters.completed);
  const calls = [];
  return {
    rows,
    calls,
    async loadInitialData(filters) {
      calls.push(["load", filters]);
      const tasks = select(filters);
      return { tasks, categories: CATEGORIES, meta: { total: tasks.length, filters } };
    },
    async getTasks(filters) {
      calls.push(["get", filters]);
      const tasks = select(filters);
      return { tasks, meta: { total: tasks.length, filters } };
    },
    async createTask() { throw new Error("не используется"); },
    async updateTask(id, changes) {
      calls.push(["update", id, changes]);
      const row = rows.find((item) => item.id === id);
      if (!row) throw new ApiError("Задача не найдена.", { kind: "http", status: 404 });
      Object.assign(row, changes);
      return { ...row };
    },
    async setTaskCompleted(id, completed) { return this.updateTask(id, { completed }); },
    async deleteTask(id) {
      calls.push(["delete", id]);
      rows.splice(rows.findIndex((item) => item.id === id), 1);
      return null;
    },
    async resetDemoData() { return { reset: true, total: rows.length }; },
  };
}

await check("В1. вариант 1: выполненная задача исчезает из выборки completed=false после повторного GET", async () => {
  assert.equal(variantNumber, 1);
  const filters = getVariantFilters(variantNumber);
  assert.deepEqual(filters, { completed: false });
  const api = memoryApi([task({ id: 4 }), task({ id: 7 }), task({ id: 9, completed: true })]);
  const view = viewDouble();
  const controller = createAppController({ api, view });
  await controller.start(filters);
  assert.deepEqual(view.log.tasks.at(-1).map((item) => item.id), [4, 7]);
  await controller.toggleTask(4);
  assert.deepEqual(api.calls.at(-1), ["get", { completed: false }]);
  assert.deepEqual(view.log.tasks.at(-1).map((item) => item.id), [7]);
  assert.equal(api.rows.find((item) => item.id === 4).completed, true);
});

await check("С1. двойной щелчок во время мутации не отправляет второй запрос", async () => {
  const api = memoryApi([task()]);
  let release;
  api.deleteTask = () => new Promise((resolve) => { release = resolve; });
  const view = viewDouble();
  const controller = createAppController({ api, view });
  await controller.start({});
  const first = controller.deleteTask(4);
  await controller.deleteTask(4);
  release(null);
  await first;
  assert.deepEqual(view.log.pending, [true, false]);
});

await check("С2. 404 при сохранении выводит из режима редактирования и обновляет список", async () => {
  const api = memoryApi([task()]);
  const view = viewDouble();
  const controller = createAppController({ api, view });
  await controller.start({});
  controller.beginEdit(4);
  api.rows.length = 0; // задачу удалили в другой вкладке
  await controller.submit({ title: "Новое", priority: "low", categoryId: "1" });
  assert.match(view.log.notices.at(-1)[0], /отсутствует/);
  assert.equal(view.log.formTasks.at(-1), null);
  assert.equal(view.log.states.at(-1)[0], "empty");
});

await check("С3. редактирование не отправляет completed, статус сохраняется", async () => {
  const api = memoryApi([task({ completed: true })]);
  const controller = createAppController({ api, view: viewDouble() });
  await controller.start({});
  controller.beginEdit(4);
  await controller.submit({ title: "Новое", priority: "low", categoryId: "1" });
  assert.deepEqual(api.calls.find((call) => call[0] === "update")[2], { title: "Новое", priority: "low", categoryId: 1 });
  assert.equal(api.rows[0].completed, true);
});

await check("С4. удаление редактируемой задачи возвращает форму в режим создания", async () => {
  const api = memoryApi([task(), task({ id: 7 })]);
  const view = viewDouble();
  const controller = createAppController({ api, view });
  await controller.start({});
  controller.beginEdit(4);
  await controller.deleteTask(4);
  assert.equal(view.log.formTasks.at(-1), null);
});

await check("С5. после destroy поздний ответ не меняет интерфейс", async () => {
  const api = memoryApi([task()]);
  let resolve;
  api.loadInitialData = () => new Promise((done) => { resolve = done; });
  const view = viewDouble();
  const controller = createAppController({ api, view });
  const pending = controller.start({});
  controller.destroy();
  resolve({ tasks: [task()], categories: CATEGORIES, meta: { total: 1, filters: {} } });
  await pending;
  assert.deepEqual(view.log.states.map(([kind]) => kind), ["loading"]);
  assert.equal(view.log.tasks.length, 0);
});

await check("С6. валидация: 101 символ, пустая категория и draft не изменяется", () => {
  const draft = Object.freeze({ title: "я".repeat(101), priority: "high", categoryId: "" });
  const result = validateTaskDraft(draft, CATEGORIES);
  assert.equal(result.valid, false);
  assert.match(result.errors.title, /100/);
  assert.equal(result.errors.categoryId, "Выберите категорию.");
  assert.equal(validateTaskDraft({ title: ` ${"я".repeat(100)} `, priority: "low", categoryId: "1" }, CATEGORIES).valid, true);
});

await check("С7. DELETE с телом вместо 204 считается invalid-response", async () => {
  const api = createTaskApi({ requestJson: async () => ({ data: { deleted: true } }) });
  await assert.rejects(api.deleteTask(4), (error) => error instanceof ApiError && error.kind === "invalid-response");
});

await check("С8. клиент: DELETE без тела не получает Content-Type, method в нижнем регистре принят", async () => {
  let init;
  const client = createApiClient({
    baseUrl: "http://example.test/api",
    fetchFn: async (url, options) => { init = options; return new Response(null, { status: 204 }); },
  });
  assert.equal(await client.requestJson("/tasks/4", { method: "delete" }), null);
  assert.equal(init.method, "DELETE");
  assert.equal(init.body, undefined);
  assert.equal("Content-Type" in init.headers, false);
});

await check("Р1. debounce: пять быстрых вызовов дают один, с последними аргументами", async () => {
  const seen = [];
  const run = debounce((value) => seen.push(value), 30);
  for (const value of ["о", "от", "отч", "отчё", "отчёт"]) {
    run(value);
    await sleep(5);
  }
  assert.deepEqual(seen, []);
  await sleep(50);
  assert.deepEqual(seen, ["отчёт"]);
});

await check("Р2. debounce: cancel снимает вызов, flush выполняет сразу", async () => {
  const seen = [];
  const run = debounce((value) => seen.push(value), 30);
  run("a");
  run.cancel();
  run("b");
  assert.equal(run.pending(), true);
  run.flush();
  assert.equal(run.pending(), false);
  await sleep(50);
  assert.deepEqual(seen, ["b"]);
  assert.throws(() => debounce(null, 10), TypeError);
});

console.log(`\nИтог собственных проверок: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
