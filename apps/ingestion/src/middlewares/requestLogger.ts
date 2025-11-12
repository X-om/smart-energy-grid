import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { httpRequestsTotal, httpRequestDuration } from '../metrics/metrics';

const logger = createLogger('request-logger');

export const requestAndMetricsLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  logger.debug({ method: req.method, path: req.path, ip: req.ip, userAgent: req.get('user-agent'), }, 'Incoming request');
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endpoint = req.route?.path || req.path;

    httpRequestsTotal.inc({ method: req.method, endpoint, status: res.statusCode.toString(), });
    httpRequestDuration.observe({ method: req.method, endpoint, status: res.statusCode.toString(), }, duration);

    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel]({ method: req.method, path: req.path, status: res.statusCode, duration, ip: req.ip, }, 'Request completed');
  });
  next();
};
