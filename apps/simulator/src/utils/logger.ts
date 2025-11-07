/**
 * Structured logging utility using Pino.
 */

import pino from 'pino';

/**
 * Create a configured logger instance.
 */
export function createLogger(logLevel: string = 'info') {
  return pino.default({
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  });
}

/**
 * Default logger instance.
 */
export const logger = createLogger(process.env.LOG_LEVEL || 'info');
