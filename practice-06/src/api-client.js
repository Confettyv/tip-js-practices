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

const METHODS = ["GET", "POST", "PATCH", "DELETE"];

function parseBaseUrl(baseUrl) {
  const base = new URL(baseUrl);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new TypeError("baseUrl должен начинаться с http:// или https://");
  }
  if (base.search || base.hash) {
    throw new TypeError("baseUrl не должен содержать query и hash");
  }
  return base;
}

function checkTimeout(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs должен быть положительным целым числом");
  }
}

export function buildUrl(baseUrl, path, query = {}) {
  const base = parseBaseUrl(baseUrl);
  const cleanPath = typeof path === "string" ? path.replace(/^\/+/, "") : "";
  if (cleanPath === "") {
    throw new TypeError("path должен быть непустой строкой");
  }
  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    throw new TypeError("query должен быть объектом");
  }

  const url = new URL(`${base.pathname.replace(/\/+$/, "")}/${cleanPath}`, base.origin);
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.append(name, String(value));
  }
  return url.toString();
}

async function createHttpError(response, url) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const apiError = payload?.error;
  const message = typeof apiError?.message === "string"
    ? apiError.message
    : `Сервер ответил ошибкой HTTP ${response.status}`;
  return new ApiError(message, {
    kind: "http",
    status: response.status,
    code: apiError?.code ?? null,
    details: apiError?.details ?? null,
    url,
  });
}

export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 3000,
} = {}) {
  parseBaseUrl(baseUrl);
  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией");
  }
  checkTimeout(timeoutMs);

  async function requestJson(path, {
    method = "GET",
    query = {},
    body,
    signal,
    timeoutMs: requestTimeout = timeoutMs,
  } = {}) {
    const httpMethod = String(method).toUpperCase();
    if (!METHODS.includes(httpMethod)) {
      throw new TypeError(`Метод ${method} не поддерживается`);
    }
    if (httpMethod === "GET" && body !== undefined) {
      throw new TypeError("У GET-запроса не может быть тела");
    }
    checkTimeout(requestTimeout);
    const url = buildUrl(baseUrl, path, query);
    const headers = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const timeoutSignal = AbortSignal.timeout(requestTimeout);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    let response;
    try {
      response = await fetchFn(url, {
        method: httpMethod,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combinedSignal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new ApiError("Запрос отменён", { kind: "aborted", url, cause: error });
      }
      if (timeoutSignal.aborted) {
        throw new ApiError(`Превышено время ожидания (${requestTimeout} мс)`, {
          kind: "timeout",
          url,
          cause: error,
        });
      }
      throw new ApiError("Не удалось связаться с сервером", { kind: "network", url, cause: error });
    }

    if (!(response instanceof Response)) {
      throw new ApiError("fetchFn вернул не Response", { kind: "invalid-response", url });
    }
    if (!response.ok) {
      throw await createHttpError(response, url);
    }
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      throw new ApiError(`Ожидался JSON, получен ${contentType || "ответ без Content-Type"}`, {
        kind: "invalid-response",
        url,
      });
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ApiError("Сервер прислал повреждённый JSON", {
        kind: "invalid-response",
        url,
        cause: error,
      });
    }
  }

  return { requestJson };
}
