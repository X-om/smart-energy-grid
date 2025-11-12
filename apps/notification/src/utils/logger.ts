import { pino } from 'pino';
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  name: process.env.SERVICE_NAME || 'notification-service', level: process.env.LOG_LEVEL || 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss.l o', ignore: 'pid,hostname'
      }
    }
  }),
  base: {
    service: process.env.SERVICE_NAME || 'notification-service',
    version: process.env.SERVICE_VERSION || '1.0.0'
  }
});

export const createLogger = (component: string) => logger.child({ component });

export const kafkaLogger = createLogger('kafka');
export const wsLogger = createLogger('websocket');
export const metricsLogger = createLogger('metrics');
export const authLogger = createLogger('auth');

export default logger;
