import { createApiClient } from "./api-client.js";
import { createAppController } from "./app-controller.js";
import { createDomView } from "./dom-app.js";
import { createTaskApi } from "./task-api.js";
import { getVariantFilters, variantNumber } from "./variant.js";

function readApiUrl(params) {
  const value = params.get("api") ?? "http://127.0.0.1:5505/api";
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Неверный протокол API.");
  return url.href.replace(/\/$/, "");
}

function withRequestTiming(client, view) {
  return {
    async requestJson(path, options = {}) {
      const label = `${(options.method ?? "GET").toUpperCase()} ${path}`;
      const startedAt = performance.now();
      const elapsed = () => Math.round(performance.now() - startedAt);
      try {
        const result = await client.requestJson(path, options);
        view.setRequestInfo(`Последний запрос: ${label}, ${elapsed()} мс`);
        return result;
      } catch (error) {
        view.setRequestInfo(`Последний запрос: ${label}, ${elapsed()} мс, ошибка ${error.kind ?? error.name}`);
        throw error;
      }
    },
  };
}

const view = createDomView();

try {
  const params = new URLSearchParams(window.location.search);
  const baseUrl = readApiUrl(params);
  const initialFilters = params.get("dataset") === "variant"
    ? getVariantFilters(variantNumber)
    : {};
  view.setApiUrl(baseUrl);
  view.setFilters(initialFilters);

  const client = createApiClient({ baseUrl, timeoutMs: 3000 });
  const api = createTaskApi(withRequestTiming(client, view));
  const controller = createAppController({ api, view });

  view.connect({
    submit: (draft) => controller.submit(draft),
    filters: (filters) => controller.applyFilters(filters),
    refresh: () => controller.refresh(),
    cancelEdit: () => controller.cancelEdit(),
    resetData: () => controller.resetData(),
    taskAction(action, id) {
      if (action === "toggle") controller.toggleTask(id);
      if (action === "edit") controller.beginEdit(id);
      if (action === "delete") controller.deleteTask(id);
    },
  });

  const ready = controller.start(initialFilters);
  window.practice06 = { controller, ready };
} catch (error) {
  console.error(error);
  view.setListState("error", "Приложение не запустилось. Проверьте Console и выполните задания в src.");
}
