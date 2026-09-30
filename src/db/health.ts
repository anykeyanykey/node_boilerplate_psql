import type { Logger } from 'pino';

export type CheckState = 'up' | 'down';

export interface CheckResult {
  state: CheckState;
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: CheckResult;
  };
}

/**
 * Deliberately narrower than `DatabaseHandle`: the checker only needs to know
 * whether a round trip succeeds, which keeps it testable without a live server.
 */
export interface Pinger {
  ping: () => Promise<void>;
}

export interface HealthCheckerOptions {
  logger: Logger;
  database: Pinger;
  required: boolean;
}

export interface HealthChecker {
  check: () => Promise<HealthReport>;
}

/**
 * `required` decides what a database outage means. When the service cannot work
 * without the database, a failed ping is `error` and the caller is expected to
 * answer 503 so the orchestrator restarts or removes the instance. When the
 * database is optional the report degrades to `degraded` and the process keeps
 * serving whatever it can.
 */
export function createHealthChecker({
  logger,
  database,
  required,
}: HealthCheckerOptions): HealthChecker {
  return {
    check: async () => {
      const startedAt = performance.now();

      try {
        await database.ping();
        const latencyMs = Math.round(performance.now() - startedAt);

        return { status: 'ok', checks: { database: { state: 'up', latencyMs } } };
      } catch (error) {
        const latencyMs = Math.round(performance.now() - startedAt);
        logger.error({ err: error, latencyMs }, 'Database health check failed');

        return {
          status: required ? 'error' : 'degraded',
          checks: {
            database: {
              state: 'down',
              latencyMs,
              // Deliberately generic: the underlying error can contain the
              // host, database name or part of the connection string.
              error: 'ping_failed',
            },
          },
        };
      }
    },
  };
}
