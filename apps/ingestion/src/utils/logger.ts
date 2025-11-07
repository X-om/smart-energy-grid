/**
 * Structured Logger using Pino
 * 
 * Provides consistent logging interface across the ingestion service.
 * Configured with pretty printing in development and JSON in production.
 */

import { pino, type Level } from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = (process.env.LOG_LEVEL || 'info') as Level;

/**
 * Create a Pino logger instance
 */
export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
    : undefined,
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

export default logger;