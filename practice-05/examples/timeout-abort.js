// Задание 8: тайм-аут и внешняя отмена на настоящем API.
// Сервер запускается здесь же на свободном порту, отдельный npm start не нужен.
import { createApiServer } from "../api/server.mjs";
import { createApiClient } from "../src/api-client.js";

const server = createApiServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const client = createApiClient({
  baseUrl: `http://127.0.0.1:${server.address().port}/api`,
  timeoutMs: 2000,
});

async function report(label, run) {
  const startedAt = performance.now();
  try {
    const payload = await run();
    console.log(`${label}: успех ${JSON.stringify(payload)}`);
  } catch (error) {
    const elapsed = (performance.now() - startedAt).toFixed(0);
    console.log(`${label}: kind=${error.kind}; «${error.message}»; cause=${error.cause?.name}; ${elapsed} мс`);
  }
}

await report("404", () => client.requestJson("/tasks/999"));
await report("тайм-аут 20 мс, ответ через 150 мс", () => client.requestJson("/debug/delay", {
  query: { ms: 150 },
  timeoutMs: 20,
}));
await report("отмена сразу после старта", () => {
  const controller = new AbortController();
  const pending = client.requestJson("/debug/delay", {
    query: { ms: 150 },
    signal: controller.signal,
    timeoutMs: 1000,
  });
  controller.abort();
  return pending;
});
await report("запас времени 1000 мс", () => client.requestJson("/debug/delay", {
  query: { ms: 150 },
  timeoutMs: 1000,
}));

server.close();
