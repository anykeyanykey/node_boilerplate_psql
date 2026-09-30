import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createDatabase } from '../../src/db/client.js';

const logger = pino({ level: 'silent' });

// Port 1 is reserved and never listening, so the pool fails fast instead of
// waiting out the default connect timeout. That keeps the suite hermetic: no
// Postgres required, no network dependency.
const UNREACHABLE = {
  DATABASE_URL: 'postgresql://app:app@127.0.0.1:1/app',
  DATABASE_CONNECT_TIMEOUT_MS: '250',
  DATABASE_POOL_MAX: '2',
};

describe('createDatabase', () => {
  it('binds the drizzle client to the pool it created', () => {
    const database = createDatabase(loadConfig(UNREACHABLE), logger);

    expect(database.db.$client).toBe(database.pool);
  });

  it('rejects the ping when the database is unreachable', async () => {
    const database = createDatabase(loadConfig(UNREACHABLE), logger);

    await expect(database.ping()).rejects.toThrow();
    await database.close();
  });

  it('closes a pool that never connected', async () => {
    const database = createDatabase(loadConfig(UNREACHABLE), logger);

    await expect(database.close()).resolves.toBeUndefined();
    expect(database.pool.ended).toBe(true);
  });

  it('exposes a ping that matches the Pinger contract used by the health check', async () => {
    const database = createDatabase(loadConfig(UNREACHABLE), logger);

    expect(database.ping).toBeTypeOf('function');
    await database.close();
  });
});
