import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies defaults for an empty environment', () => {
    const config = loadConfig({});

    expect(config.NODE_ENV).toBe('development');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.SERVICE_NAME).toBe('node_boilerplate_psql');
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(10_000);
  });

  it('coerces numeric strings', () => {
    const config = loadConfig({ PORT: '8080', SHUTDOWN_TIMEOUT_MS: '2500' });

    expect(config.PORT).toBe(8080);
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(2500);
  });

  it('reads explicit values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
      SERVICE_NAME: 'custom',
      PORT: '4000',
      HOST: '127.0.0.1',
    });

    expect(config.NODE_ENV).toBe('production');
    expect(config.LOG_LEVEL).toBe('debug');
    expect(config.SERVICE_NAME).toBe('custom');
    expect(config.PORT).toBe(4000);
    expect(config.HOST).toBe('127.0.0.1');
  });

  it('throws a descriptive error for invalid values', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/Invalid environment configuration/);
  });

  it('rejects a port above the valid range', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rejects an empty API_TOKEN', () => {
    expect(() => loadConfig({ API_TOKEN: '' })).toThrow(/API_TOKEN/);
  });

  it('keeps a valid API_TOKEN', () => {
    expect(loadConfig({ API_TOKEN: 'secret-value' }).API_TOKEN).toBe('secret-value');
  });
});
