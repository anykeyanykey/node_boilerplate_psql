import { pino } from 'pino';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createAppServer } from './server.js';

function main(): void {
  const config = loadConfig();
  const logger = createLogger(config);
  const server = createAppServer({
    logger,
    port: config.PORT,
    host: config.HOST,
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
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Service started');
}

try {
  main();
} catch (error) {
  pino({ level: 'fatal' }).fatal({ err: error }, 'Fatal error during startup');
  process.exit(1);
}
