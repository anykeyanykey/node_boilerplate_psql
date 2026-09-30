import { pino } from 'pino';
import type { Logger } from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Config): Logger {
  return pino({
    name: config.SERVICE_NAME,
    level: config.LOG_LEVEL,
    base: { env: config.NODE_ENV },
    redact: {
      // Pino paths match object keys, so a top-level 'DATABASE_URL' entry alone
      // would not catch the same secret logged as `{ databaseUrl }`. Every
      // sensitive variable is listed both bare and under a wildcard.
      paths: [
        '*.token',
        '*.password',
        '*.secret',
        'API_TOKEN',
        '*.API_TOKEN',
        'DATABASE_URL',
        '*.DATABASE_URL',
        '*.databaseUrl',
        '*.connectionString',
        'POSTGRES_PASSWORD',
        '*.POSTGRES_PASSWORD',
      ],
      censor: '[redacted]',
    },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
