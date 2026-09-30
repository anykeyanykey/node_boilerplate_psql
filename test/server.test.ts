import { pino } from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer, type AppServerOptions } from '../src/server.js';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const servers: Server[] = [];

afterEach(async () => {
  const open = servers.splice(0);
  await Promise.all(
    open.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        }),
    ),
  );
});

async function startServer(overrides: Partial<AppServerOptions> = {}): Promise<string> {
  const server = createAppServer({
    logger: pino({ level: 'silent' }),
    port: 0,
    host: '127.0.0.1',
    ...overrides,
  });
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.once('listening', () => {
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('createAppServer', () => {
  it('responds 200 on GET /health', async () => {
    const base = await startServer();

    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('responds 404 with a json body for unknown routes', async () => {
    const base = await startServer();

    const response = await fetch(`${base}/nope`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('responds 404 when /health is requested with another method', async () => {
    const base = await startServer();

    const response = await fetch(`${base}/health`, { method: 'POST' });

    expect(response.status).toBe(404);
  });

  it('sets a failing exit code when the port is already taken', async () => {
    const first = await startServer({ port: 0 });
    const { port } = new URL(first);

    const previousExitCode = process.exitCode;
    const errors: unknown[] = [];
    const server = createAppServer({
      logger: Object.assign(pino({ level: 'silent' }), {
        error: (obj: unknown) => errors.push(obj),
      }),
      port: Number(port),
      host: '127.0.0.1',
    });
    servers.push(server);

    await new Promise<void>((resolve) => {
      server.once('error', () => {
        resolve();
      });
    });

    expect(process.exitCode).toBe(1);
    expect(errors).toHaveLength(1);
    process.exitCode = previousExitCode;
  });
});
