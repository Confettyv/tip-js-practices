import { Pool } from 'pg';

export function createPool(connectionString, logger) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  pool.on('error', (error) => {
    if (logger) {
      logger.error('database_idle_client_error', { code: error.code, message: error.message });
    } else {
      console.error('Ошибка простаивающего подключения PostgreSQL:', error.message);
    }
  });
  return pool;
}
