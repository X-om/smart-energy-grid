import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { ingestionErrorsTotal } from '../metrics/metrics';

const logger = createLogger('error-handler');

export const globalErrorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  ingestionErrorsTotal.inc({ error_type: 'unhandled' });

  logger.error({
    error: err, method: req.method, path: req.path, ip: req.ip, userAgent: req.get('user-agent')
  }, 'Unhandled error in request');

  res.status(500).json({
    status: 'error', message: 'Internal server error', ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void =>
  void res.status(404).json({ status: 'error', message: 'Not found', path: req.path });
