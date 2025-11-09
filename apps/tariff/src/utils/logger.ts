
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';
const pinoLogger = (pino).default || pino;
const logger = pinoLogger({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:mm:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined,
});

export const createLogger = (context: string) => logger.child({ context });
export default logger;
