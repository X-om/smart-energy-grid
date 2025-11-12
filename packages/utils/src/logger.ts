
import { pino } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
const logLevel = (process.env.LOG_LEVEL || 'info');


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

export function createLogger(component: string): pino.Logger {
  return logger.child({ component });
}

export const kafkaLogger = createLogger('kafka');
export const dbLogger = createLogger('database');
export const redisLogger = createLogger('redis');
export const httpLogger = createLogger('http');
export const metricsLogger = createLogger('metrics');

export default logger;
