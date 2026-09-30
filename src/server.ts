import { createServer, type Server } from 'node:http';
import type { Logger } from 'pino';

export interface AppServerOptions {
  logger: Logger;
  port: number;
  host: string;
}

export function createAppServer({ logger, port, host }: AppServerOptions): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    logger.warn({ url: req.url, method: req.method }, 'Unhandled request');
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
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
