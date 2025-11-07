import pino from 'pino';

/**
 * Structured logger using Pino
 * Provides consistent logging across the API Gateway service
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
      : undefined,
  base: {
    service: 'api-gateway',
    environment: process.env.NODE_ENV || 'development',
  },
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

/**
 * Component-specific loggers
 */
export const dbLogger = logger.child({ component: 'database' });
export const authLogger = logger.child({ component: 'auth' });
export const apiLogger = logger.child({ component: 'api' });
export const cacheLogger = logger.child({ component: 'cache' });
