import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const levelRank = { debug: 10, info: 20, warn: 30, error: 40 };
const sensitiveKeys = new Set(['password', 'authorization', 'cookie', 'connectionstring']);

// Скрытие идёт по ключам на любой глубине: секрет часто лежит во вложенном
// объекте (headers.authorization, db.connectionString).
function redact(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = sensitiveKeys.has(key.toLowerCase()) ? '[REDACTED]' : redact(item, seen);
  }
  return result;
}

export function createLogger({
  level = 'info',
  output = process.stdout,
  clock = () => new Date(),
} = {}) {
  if (!Object.hasOwn(levelRank, level)) {
    throw new Error(`Неизвестный уровень логов: ${level}.`);
  }
  const threshold = levelRank[level];

  function write(eventLevel, event, fields = {}) {
    if (levelRank[eventLevel] < threshold) {
      return;
    }
    // Служебные поля идут первыми и не перезаписываются полями события.
    const record = { timestamp: clock().toISOString(), level: eventLevel, event };
    for (const [key, item] of Object.entries(redact(fields))) {
      if (!Object.hasOwn(record, key)) {
        record[key] = item;
      }
    }
    output.write(`${JSON.stringify(record)}\n`);
  }

  return {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

// Вариант 1: входной X-Request-Id принимается, только если это короткий
// идентификатор из безопасных символов. Иначе клиент мог бы вписать в журнал
// перевод строки, управляющие символы или мегабайт текста.
export const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

export function isSafeRequestId(value) {
  return typeof value === 'string' && requestIdPattern.test(value);
}

function statusLevel(status) {
  if (status >= 500) {
    return 'error';
  }
  return status >= 400 ? 'warn' : 'info';
}

export function requestLogger({
  logger,
  createRequestId = randomUUID,
  clock = () => performance.now(),
} = {}) {
  if (!logger) {
    throw new TypeError('Для журнала запросов требуется logger.');
  }
  return (req, res, next) => {
    const incoming = req.get('X-Request-Id');
    const requestId = isSafeRequestId(incoming) ? incoming : createRequestId();
    req.requestId = requestId;
    res.set('X-Request-Id', requestId);

    // Монотонные часы для длительности: системное время может сдвинуться (NTP).
    const startedAt = clock();
    let logged = false;
    const finish = (aborted) => {
      if (logged) {
        return;
      }
      logged = true;
      const status = res.statusCode;
      const fields = {
        requestId,
        method: req.method,
        // originalUrl без query string: в ней бывают поисковые запросы и токены.
        path: req.originalUrl.split('?')[0],
        status,
        durationMs: Math.round((clock() - startedAt) * 10) / 10,
      };
      if (aborted) {
        fields.aborted = true;
      }
      logger[statusLevel(status)]('http_request', fields);
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(true));
    next();
  };
}
