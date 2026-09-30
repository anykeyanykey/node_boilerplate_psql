import { pino } from 'pino';
import type { Logger } from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Config): Logger {
  return pino({
    name: config.SERVICE_NAME,
    level: config.LOG_LEVEL,
    base: { env: config.NODE_ENV },
    redact: {
      paths: ['*.token', '*.password', '*.secret', 'API_TOKEN'],
      censor: '[redacted]',
    },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
