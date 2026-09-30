import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';

describe('createLogger', () => {
  it('does not attach the pretty transport in production', () => {
    const logger = createLogger(loadConfig({ NODE_ENV: 'production' }));

    expect(logger.level).toBe('info');
    expect(logger.bindings()['env']).toBe('production');
  });

  it('honours the configured log level', () => {
    const logger = createLogger(loadConfig({ LOG_LEVEL: 'warn' }));

    expect(logger.level).toBe('warn');
  });
});
