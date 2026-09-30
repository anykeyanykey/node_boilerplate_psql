import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const DATABASE_URL = 'postgresql://app:app@127.0.0.1:5432/app';

describe('loadConfig', () => {
  it('applies defaults for an empty environment', () => {
    const config = loadConfig({ DATABASE_URL });

    expect(config.NODE_ENV).toBe('development');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.SERVICE_NAME).toBe('node_boilerplate_psql');
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(10_000);
  });

  it('coerces numeric strings', () => {
    const config = loadConfig({ DATABASE_URL, PORT: '8080', SHUTDOWN_TIMEOUT_MS: '2500' });

    expect(config.PORT).toBe(8080);
    expect(config.SHUTDOWN_TIMEOUT_MS).toBe(2500);
  });

  it('reads explicit values', () => {
    const config = loadConfig({
      DATABASE_URL,
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
    expect(() => loadConfig({ DATABASE_URL, PORT: 'not-a-port' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects a port above the valid range', () => {
    expect(() => loadConfig({ DATABASE_URL, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ DATABASE_URL, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rejects an empty API_TOKEN', () => {
    expect(() => loadConfig({ DATABASE_URL, API_TOKEN: '' })).toThrow(/API_TOKEN/);
  });

  it('keeps a valid API_TOKEN', () => {
    expect(loadConfig({ DATABASE_URL, API_TOKEN: 'secret-value' }).API_TOKEN).toBe('secret-value');
  });

  describe('database', () => {
    it('requires DATABASE_URL', () => {
      expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    });

    it('rejects a DATABASE_URL that is not a URL', () => {
      expect(() => loadConfig({ DATABASE_URL: 'not a url' })).toThrow(/DATABASE_URL/);
    });

    it('applies pool defaults', () => {
      const config = loadConfig({ DATABASE_URL });

      expect(config.DATABASE_POOL_MAX).toBe(10);
      expect(config.DATABASE_IDLE_TIMEOUT_MS).toBe(30_000);
      expect(config.DATABASE_CONNECT_TIMEOUT_MS).toBe(5_000);
      expect(config.DATABASE_STATEMENT_TIMEOUT_MS).toBe(10_000);
      expect(config.DATABASE_SSL).toBe(false);
      expect(config.DB_REQUIRED).toBe(true);
    });

    it('coerces pool settings from strings', () => {
      const config = loadConfig({
        DATABASE_URL,
        DATABASE_POOL_MAX: '25',
        DATABASE_IDLE_TIMEOUT_MS: '1000',
        DATABASE_CONNECT_TIMEOUT_MS: '250',
        DATABASE_STATEMENT_TIMEOUT_MS: '750',
      });

      expect(config.DATABASE_POOL_MAX).toBe(25);
      expect(config.DATABASE_IDLE_TIMEOUT_MS).toBe(1000);
      expect(config.DATABASE_CONNECT_TIMEOUT_MS).toBe(250);
      expect(config.DATABASE_STATEMENT_TIMEOUT_MS).toBe(750);
    });

    it('rejects a pool size outside the supported range', () => {
      expect(() => loadConfig({ DATABASE_URL, DATABASE_POOL_MAX: '0' })).toThrow(
        /DATABASE_POOL_MAX/,
      );
      expect(() => loadConfig({ DATABASE_URL, DATABASE_POOL_MAX: '101' })).toThrow(
        /DATABASE_POOL_MAX/,
      );
    });

    it('turns the string flags into booleans', () => {
      expect(loadConfig({ DATABASE_URL, DATABASE_SSL: 'true' }).DATABASE_SSL).toBe(true);
      expect(loadConfig({ DATABASE_URL, DATABASE_SSL: 'false' }).DATABASE_SSL).toBe(false);
      expect(loadConfig({ DATABASE_URL, DB_REQUIRED: 'false' }).DB_REQUIRED).toBe(false);
      expect(loadConfig({ DATABASE_URL, DB_REQUIRED: 'true' }).DB_REQUIRED).toBe(true);
    });

    it('rejects a non-boolean flag', () => {
      expect(() => loadConfig({ DATABASE_URL, DATABASE_SSL: 'yes' })).toThrow(/DATABASE_SSL/);
      expect(() => loadConfig({ DATABASE_URL, DB_REQUIRED: 'maybe' })).toThrow(/DB_REQUIRED/);
    });
  });
});
