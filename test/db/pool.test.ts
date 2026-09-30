import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createPool } from '../../src/db/pool.js';

const DATABASE_URL = 'postgresql://app:app@127.0.0.1:5432/app';
const logger = pino({ level: 'silent' });

function poolFor(overrides: Record<string, string> = {}) {
  return createPool(loadConfig({ DATABASE_URL, ...overrides }), logger);
}

describe('createPool', () => {
  it('maps the configuration onto the pool', () => {
    const pool = poolFor({
      DATABASE_POOL_MAX: '7',
      DATABASE_IDLE_TIMEOUT_MS: '1234',
      DATABASE_CONNECT_TIMEOUT_MS: '4321',
      DATABASE_STATEMENT_TIMEOUT_MS: '9999',
    });

    expect(pool.options.max).toBe(7);
    expect(pool.options.idleTimeoutMillis).toBe(1234);
    expect(pool.options.connectionTimeoutMillis).toBe(4321);
    expect(pool.options.statement_timeout).toBe(9999);
    expect(pool.options.connectionString).toBe(DATABASE_URL);
  });

  it('omits the ssl option entirely when DATABASE_SSL is false', () => {
    const pool = poolFor({ DATABASE_SSL: 'false' });

    // Undefined, not false: leaving the key out lets node-postgres fall back to
    // its own default instead of forcing ssl: false onto the connection.
    expect(pool.options.ssl).toBeUndefined();
  });

  it('enables ssl when DATABASE_SSL is true', () => {
    const pool = poolFor({ DATABASE_SSL: 'true' });

    expect(pool.options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('attaches an error listener so an idle client error cannot crash the process', () => {
    const pool = poolFor();

    expect(pool.listenerCount('error')).toBe(1);
  });

  it('logs the error emitted on an idle client instead of throwing', () => {
    const logged: unknown[] = [];
    const pool = createPool(
      loadConfig({ DATABASE_URL }),
      Object.assign(pino({ level: 'silent' }), {
        error: (obj: unknown) => logged.push(obj),
      }),
    );

    expect(() => {
      pool.emit('error', new Error('server closed the connection unexpectedly'));
    }).not.toThrow();
    expect(logged).toHaveLength(1);
  });
});
