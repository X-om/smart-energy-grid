/**
 * Centralized logging utility for SEGS services.
 * Uses Pino for structured, high-performance logging.
 */

import pkg from 'pino';
const pino = pkg.default || pkg;

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
const logLevel = (process.env.LOG_LEVEL || 'info') as any;

/**
 * Base logger instance with common configuration.
 * All services should use createLogger() to get a child logger with component context.
 */
export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    }
    : undefined,
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
  },
  base: {
    service: process.env.SERVICE_NAME || 'segs-service',
    version: process.env.npm_package_version || '1.0.0',
  },
});

/**
 * Create a child logger with component/module context.
 * Use this in services to identify which component is logging.
 * 
 * @param component - Component or module name (e.g., 'kafka-consumer', 'aggregator')
 * @returns Child logger instance with component context
 * 
 * @example
 * ```typescript
 * import { createLogger } from '@segs/utils';
 * const logger = createLogger('my-service');
 * logger.info('Service started');
 * ```
 */
export function createLogger(component: string): any {
  return logger.child({ component });
}

/**
 * Common specialized loggers for frequently used components.
 * Services can import these directly or create their own using createLogger().
 */
export const kafkaLogger = createLogger('kafka');
export const dbLogger = createLogger('database');
export const redisLogger = createLogger('redis');
export const httpLogger = createLogger('http');
export const metricsLogger = createLogger('metrics');

export default logger;
