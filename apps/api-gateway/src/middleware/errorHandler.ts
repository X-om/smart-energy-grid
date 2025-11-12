import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';


export const errorHandler = (err: Error | AppError, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Error:', err);
  if (err instanceof AppError)
    return void errorResponse(res, err.statusCode, err.message, err.code, err.details, err.stack);

  errorResponse(res, 500, err.message || 'Internal server error', 'INTERNAL_SERVER_ERROR', undefined, err.stack);
}

// * 404 Not Found handler
export const notFoundHandler = (_req: Request, res: Response): void =>
  void errorResponse(res, 404, 'Route not found', 'NOT_FOUND');
