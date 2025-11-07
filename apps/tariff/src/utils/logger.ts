/**
 * Logger Utility
 * 
 * Pino-based structured logging with context support
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

// Handle CommonJS default export
const pinoLogger = (pino as any).default || pino;

const logger = pinoLogger({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
    : undefined,
});

export function createLogger(context: string) {
  return logger.child({ context });
}

export default logger;
