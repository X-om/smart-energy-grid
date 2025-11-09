import { pino, type Level } from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = (process.env.LOG_LEVEL || 'info') as Level;


export const logger = pino({
  level: logLevel, transport: isDevelopment ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
  } : undefined,
  formatters: { level: (label: string) => ({ level: label.toUpperCase() }) }
});

export const createLogger = (context: string) => logger.child({ context });
export default logger;
