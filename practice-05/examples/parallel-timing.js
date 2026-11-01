// Временный эксперимент к заданию 7: два независимых ответа по 300 мс.
// Последовательно ожидается ~600 мс, через Promise.all — ~300 мс.
// Требует запущенного API (npm start). В рабочие модули задержки не входят.
import { createApiClient } from "../src/api-client.js";

const baseUrl = process.env.API_URL ?? "http://127.0.0.1:5505/api";
const client = createApiClient({ baseUrl, timeoutMs: 2000 });
const delay = (ms) => client.requestJson("/debug/delay", { query: { ms } });

async function sequential() {
  await delay(300);
  await delay(300);
}

async function parallel() {
  await Promise.all([delay(300), delay(300)]);
}

async function measure(label, run) {
  const results = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = performance.now();
    await run();
    results.push(performance.now() - startedAt);
  }
  const average = results.reduce((sum, value) => sum + value, 0) / results.length;
  console.log(`${label}: ${results.map((value) => value.toFixed(1)).join(" / ")} мс; среднее ${average.toFixed(1)} мс`);
}

await delay(0);
await measure("последовательно", sequential);
await measure("Promise.all   ", parallel);
