import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';

interface Pm2App {
  name: string;
  script: string;
  instances: number;
  exec_mode: string;
  autorestart: boolean;
  kill_timeout: number;
  out_file: string;
  error_file: string;
  env: Record<string, string>;
  env_development: Record<string, string>;
}

const nodeRequire = createRequire(import.meta.url);
const ECOSYSTEM_PATH = nodeRequire.resolve('../ecosystem.config.cjs');

function clearEcosystemCache(): void {
  Reflect.deleteProperty(nodeRequire.cache, ECOSYSTEM_PATH);
}

function loadEcosystem(): Pm2App {
  clearEcosystemCache();
  const config = nodeRequire(ECOSYSTEM_PATH) as { apps: Pm2App[] };
  const [app] = config.apps;
  if (!app) throw new Error('ecosystem.config.cjs declares no apps');
  return app;
}

afterEach(() => {
  vi.unstubAllEnvs();
  clearEcosystemCache();
});

describe('ecosystem.config.cjs', () => {
  it('runs the compiled entrypoint as a single forked instance', () => {
    const app = loadEcosystem();

    expect(app.name).toBe('node_boilerplate_psql');
    expect(app.script).toBe('dist/index.js');
    expect(app.instances).toBe(1);
    expect(app.exec_mode).toBe('fork');
    expect(app.autorestart).toBe(true);
  });

  it('allows PM2 more time to stop than the app needs to shut down', () => {
    const app = loadEcosystem();
    const { SHUTDOWN_TIMEOUT_MS } = loadConfig({});

    expect(app.kill_timeout).toBeGreaterThan(SHUTDOWN_TIMEOUT_MS);
  });

  it('writes to log files on the host', () => {
    const app = loadEcosystem();

    expect(app.out_file).toBe('logs/out.log');
    expect(app.error_file).toBe('logs/error.log');
  });

  it('writes to stdout/stderr when LOG_TO_STDOUT is set', () => {
    vi.stubEnv('LOG_TO_STDOUT', 'true');

    const app = loadEcosystem();

    expect(app.out_file).toBe('/dev/stdout');
    expect(app.error_file).toBe('/dev/stderr');
  });

  it('defaults to production and has a development override', () => {
    const app = loadEcosystem();

    expect(app.env['NODE_ENV']).toBe('production');
    expect(app.env_development['NODE_ENV']).toBe('development');
    expect(app.env_development['LOG_LEVEL']).toBe('debug');
  });
});
