export class ApiError extends Error {
  constructor(message, {
    kind,
    status = null,
    code = null,
    details = null,
    url = null,
    cause,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

// Проверяет baseUrl и возвращает новый объект URL: абсолютный http(s) без query и hash.
function parseBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError(`baseUrl должен быть абсолютным адресом: «${baseUrl}».`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(`baseUrl должен использовать http или https, получено ${url.protocol}`);
  }
  if (/[?#]/.test(baseUrl)) {
    throw new TypeError("baseUrl не должен содержать query или hash.");
  }
  return url;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// path — относительный путь без query: "tasks", "/tasks/4/". Сегменты "." и ".."
// запрещены, иначе URL нормализует путь и запрос уйдёт за пределы baseUrl.
function normalizePath(path) {
  if (typeof path !== "string") {
    throw new TypeError("path должен быть строкой.");
  }
  const trimmed = path.replace(/^\/+|\/+$/g, "");
  const segments = trimmed.split("/");
  if (
    trimmed === ""
    || /[?#]/.test(trimmed)
    || /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError(`path должен быть непустым относительным путём: «${path}».`);
  }
  return trimmed;
}

// Создаёт URL относительно baseUrl и добавляет непустые параметры query.
// Значения кодируются средствами URL и URLSearchParams, а не вручную.
export function buildUrl(baseUrl, path, query = {}) {
  const url = parseBaseUrl(baseUrl);
  const relativePath = normalizePath(path);
  if (!isPlainObject(query)) {
    throw new TypeError("query должен быть обычным объектом.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${relativePath}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.append(key, String(value));
  }
  url.search = params.toString();
  return url.href;
}

function checkTimeout(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} должен быть положительным целым числом миллисекунд.`);
  }
}

// "application/json; charset=utf-8" и "application/problem+json" считаются JSON.
function isJsonContentType(contentType) {
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

// Причину отказа определяет сигнал, а не текст ошибки: AbortSignal.any сохраняет
// reason того сигнала, который сработал первым.
function classifyFailure(error, { url, signal, timeoutSignal, timeoutMs }) {
  if (signal.aborted && signal.reason === timeoutSignal.reason) {
    return new ApiError(`Превышено время ожидания ответа: ${timeoutMs} мс.`, {
      kind: "timeout",
      url,
      cause: error,
    });
  }
  if (signal.aborted) {
    return new ApiError("Запрос отменён вызывающим кодом.", { kind: "aborted", url, cause: error });
  }
  return new ApiError("Сервер недоступен: ответ не получен.", { kind: "network", url, cause: error });
}

// Тело ошибки читается как текст: у 502 от прокси вместо JSON может быть HTML.
// Вид http и статус сохраняются в любом случае.
async function createHttpError(response, url) {
  let info = null;
  try {
    const payload = JSON.parse(await response.text());
    info = isPlainObject(payload?.error) ? payload.error : null;
  } catch {
    info = null;
  }
  const message = typeof info?.message === "string" && info.message !== ""
    ? info.message
    : `HTTP ${response.status}: сервер вернул ошибку.`;
  return new ApiError(message, {
    kind: "http",
    status: response.status,
    code: typeof info?.code === "string" ? info.code : null,
    details: info?.details ?? null,
    url,
  });
}

// fetchFn передаётся явно, чтобы модуль можно было проверить без реальной сети.
// Возвращаемый объект: { requestJson(path, { query, signal, timeoutMs } = {}) }.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  parseBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией.");
  }
  checkTimeout(timeoutMs, "timeoutMs");
  const defaultTimeoutMs = timeoutMs;

  async function requestJson(path, {
    query = {},
    signal: externalSignal,
    timeoutMs: requestTimeoutMs = defaultTimeoutMs,
  } = {}) {
    const url = buildUrl(baseUrl, path, query);
    checkTimeout(requestTimeoutMs, "timeoutMs");
    if (externalSignal !== undefined && !(externalSignal instanceof AbortSignal)) {
      throw new TypeError("signal должен быть AbortSignal.");
    }

    const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;
    const context = { url, signal, timeoutSignal, timeoutMs: requestTimeoutMs };

    // В этом try только fetch: ошибки обработки ответа ниже не станут network.
    let response;
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (error) {
      throw classifyFailure(error, context);
    }

    if (!(response instanceof Response)) {
      throw new ApiError("fetchFn вернул значение, не являющееся Response.", {
        kind: "invalid-response",
        url,
      });
    }
    if (!response.ok) {
      throw await createHttpError(response, url);
    }
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!isJsonContentType(contentType)) {
      throw new ApiError(`Ожидался JSON, получен Content-Type «${contentType || "не указан"}».`, {
        kind: "invalid-response",
        url,
      });
    }
    try {
      return await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ApiError("Тело ответа не является корректным JSON.", {
          kind: "invalid-response",
          url,
          cause: error,
        });
      }
      // Тело ещё читалось, когда сработал тайм-аут, отмена или оборвалась связь.
      throw classifyFailure(error, context);
    }
  }

  return { requestJson };
}
