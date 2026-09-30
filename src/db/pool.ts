import { Pool } from 'pg';
import type { Logger } from 'pino';
import type { Config } from '../config.js';

export function createPool(config: Config, logger: Logger): Pool {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: config.DATABASE_CONNECT_TIMEOUT_MS,
    statement_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS,
    ...(config.DATABASE_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  // An idle client that is dropped by the server emits 'error'. Without a
  // listener node-postgres rethrows it as an uncaught exception and kills the
  // process, so this handler is what keeps a database blip from becoming an
  // outage.
  pool.on('error', (error) => {
    logger.error({ err: error }, 'Unexpected error on idle database client');
  });

  return pool;
}
