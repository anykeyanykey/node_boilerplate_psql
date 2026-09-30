import { pino } from 'pino';
import { loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { createHealthChecker } from './db/health.js';
import { createLogger } from './logger.js';
import { createAppServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDatabase(config, logger);

  if (config.DB_REQUIRED) {
    try {
      await database.ping();
      logger.info('Database connection established');
    } catch (error) {
      // Fail fast: a required database that is unreachable at boot means every
      // request would fail anyway, so there is no point in accepting traffic.
      await database.close().catch(() => undefined);
      throw error;
    }
  } else {
    logger.warn('DB_REQUIRED is false, starting without verifying the database');
  }

  const health = createHealthChecker({
    logger,
    database,
    required: config.DB_REQUIRED,
  });

  const server = createAppServer({
    logger,
    port: config.PORT,
    host: config.HOST,
    checkHealth: health.check,
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    server.close((error) => {
      if (error) {
        logger.error({ err: error }, 'Error while closing server');
        process.exit(1);
      }
      // Drain the pool after the listener is closed: in-flight requests are done
      // by then, and pool.end() waits for checked-out clients to be released.
      database
        .close()
        .then(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        })
        .catch((closeError: unknown) => {
          logger.error({ err: closeError }, 'Error while closing the database pool');
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Service started');
}

main().catch((error: unknown) => {
  pino({ level: 'fatal' }).fatal({ err: error }, 'Fatal error during startup');
  process.exit(1);
});
