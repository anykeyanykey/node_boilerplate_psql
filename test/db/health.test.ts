import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createHealthChecker, type HealthReport, type Pinger } from '../../src/db/health.js';

function checkerFor(
  database: Pinger,
  required: boolean,
): { check: () => Promise<HealthReport>; logged: unknown[] } {
  const logged: unknown[] = [];
  const logger = Object.assign(pino({ level: 'silent' }), {
    error: (obj: unknown) => logged.push(obj),
  });

  return { check: createHealthChecker({ logger, database, required }).check, logged };
}

describe('createHealthChecker', () => {
  it('reports the database as up when the ping succeeds', async () => {
    const { check } = checkerFor({ ping: () => Promise.resolve() }, true);

    const report = await check();

    expect(report.status).toBe('ok');
    expect(report.checks.database.state).toBe('up');
    expect(report.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(report.checks.database.error).toBeUndefined();
  });

  it('reports an error when a required database is down', async () => {
    const { check, logged } = checkerFor(
      { ping: () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432')) },
      true,
    );

    const report = await check();

    expect(report.status).toBe('error');
    expect(report.checks.database.state).toBe('down');
    expect(logged).toHaveLength(1);
  });

  it('only degrades when the database is optional', async () => {
    const { check } = checkerFor({ ping: () => Promise.reject(new Error('boom')) }, false);

    const report = await check();

    expect(report.status).toBe('degraded');
    expect(report.checks.database.state).toBe('down');
  });

  it('does not leak the driver error message into the report', async () => {
    const { check } = checkerFor(
      { ping: () => Promise.reject(new Error('password authentication failed for user "app"')) },
      true,
    );

    const report = await check();

    expect(report.checks.database.error).toBe('ping_failed');
    expect(JSON.stringify(report)).not.toContain('password');
    expect(JSON.stringify(report)).not.toContain('app"');
  });

  it('does not throw when the ping rejects', async () => {
    const { check } = checkerFor({ ping: () => Promise.reject(new Error('boom')) }, true);

    await expect(check()).resolves.toBeDefined();
  });
});
