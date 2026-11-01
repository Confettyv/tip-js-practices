// Первая цифра не ноль: иначе «05505» прошло бы как 5505 (дефект найден в ПР13).
function parsePort(raw) {
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error('API_PORT должен быть целым числом от 1024 до 65535.');
  }
  const port = Number(raw);
  if (port < 1024 || port > 65535) {
    throw new Error('API_PORT должен быть целым числом от 1024 до 65535.');
  }
  return port;
}

function parseBoolean(raw, name) {
  if (raw === undefined) {
    return false;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  throw new Error(`${name} должен быть true или false.`);
}

// Пустое значение и пробелы внутри адреса — почти всегда опечатка в .env.
function parseHost(raw) {
  if (raw === '' || raw.length > 255 || /\s/.test(raw)) {
    throw new Error('API_HOST должен быть непустой строкой без пробелов, не длиннее 255.');
  }
  return raw;
}

function parseChoice(raw, name, allowed) {
  if (!allowed.includes(raw)) {
    throw new Error(`${name} должен быть одним из: ${allowed.join(', ')}.`);
  }
  return raw;
}

function parseReleaseVersion(raw) {
  if (!/^[\w.-]{1,64}$/.test(raw)) {
    throw new Error('RELEASE_VERSION: 1–64 символа, буквы, цифры, «.», «_» и «-».');
  }
  return raw;
}

export const environments = ['development', 'test', 'production'];
export const logLevels = ['debug', 'info', 'warn', 'error'];

export function readConfig(env = process.env) {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('Не задан DATABASE_URL. Создайте .env по образцу .env.example.');
  }
  const environment = parseChoice(env.NODE_ENV ?? 'development', 'NODE_ENV', environments);
  const enableDebugReset = parseBoolean(env.ENABLE_DEBUG_RESET, 'ENABLE_DEBUG_RESET');
  // Маршрут сброса стирает все данные: в production он запрещён кодом, а не только документацией.
  if (environment === 'production' && enableDebugReset) {
    throw new Error('ENABLE_DEBUG_RESET=true запрещён при NODE_ENV=production.');
  }
  return {
    host: parseHost(env.API_HOST ?? '127.0.0.1'),
    port: parsePort(env.API_PORT ?? '5505'),
    connectionString,
    enableDebugReset,
    environment,
    logLevel: parseChoice(env.LOG_LEVEL ?? 'info', 'LOG_LEVEL', logLevels),
    releaseVersion: parseReleaseVersion(env.RELEASE_VERSION ?? '0.0.0-local'),
  };
}
