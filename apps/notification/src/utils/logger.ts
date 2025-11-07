import pkg from 'pino';
// @ts-ignore - pino typing issue with ES modules
const pino = pkg.default || pkg;

const isDevelopment = process.env.NODE_ENV === 'development';

// Create base logger
export const logger = pino({
  name: process.env.SERVICE_NAME || 'notification-service',
  level: process.env.LOG_LEVEL || 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
        ignore: 'pid,hostname'
      }
    }
  }),
  base: {
    service: process.env.SERVICE_NAME || 'notification-service',
    version: process.env.SERVICE_VERSION || '1.0.0'
  }
});

// Create child loggers for different components
export const createLogger = (component: string) => {
  return logger.child({ component });
};

export const kafkaLogger = createLogger('kafka');
export const wsLogger = createLogger('websocket');
export const metricsLogger = createLogger('metrics');
export const authLogger = createLogger('auth');

export default logger;
