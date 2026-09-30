import { createServer, type Server, type ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import type { HealthReport } from './db/health.js';

export interface AppServerOptions {
  logger: Logger;
  port: number;
  host: string;
  checkHealth: () => Promise<HealthReport>;
}

const STATUS_CODES: Record<HealthReport['status'], number> = {
  ok: 200,
  degraded: 200,
  error: 503,
};

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function createAppServer({ logger, port, host, checkHealth }: AppServerOptions): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      void checkHealth()
        .then((report) => {
          sendJson(res, STATUS_CODES[report.status], report);
        })
        .catch((error: unknown) => {
          // createHealthChecker swallows its own errors, so reaching here means
          // the health check itself is broken. Report it instead of hanging.
          logger.error({ err: error }, 'Health check threw unexpectedly');
          sendJson(res, 503, { status: 'error', checks: {} });
        });
      return;
    }

    logger.warn({ url: req.url, method: req.method }, 'Unhandled request');
    sendJson(res, 404, { error: 'not_found' });
  });

  server.on('error', (error) => {
    logger.error({ err: error }, 'HTTP server error');
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    logger.info({ port, host }, 'HTTP server listening');
  });

  return server;
}
