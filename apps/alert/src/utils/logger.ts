import { pino } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  },
  base: {
    service: 'alert-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

// Create child loggers for different components
export const createLogger = (component: string) => {
  return logger.child({ component });
};

export const kafkaLogger = createLogger('kafka');
export const dbLogger = createLogger('database');
export const redisLogger = createLogger('redis');
export const alertLogger = createLogger('alerts');
export const apiLogger = createLogger('api');

export default logger;