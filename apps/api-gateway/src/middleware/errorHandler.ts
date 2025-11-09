import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ApiResponse } from '../types/index.js';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const response: ApiResponse = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error',
      details: err.details,
    },
  };

  res.status(statusCode).json(response);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  } as ApiResponse);
}
