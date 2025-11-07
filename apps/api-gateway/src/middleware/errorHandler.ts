import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { sendError, sendInternalError } from '../utils/response.js';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns consistent error responses
 */
export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  const errorLog = {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    userId: (req as any).user?.userId,
  };

  if (error instanceof ApiError && error.isOperational) {
    logger.warn('Operational error occurred', errorLog);
  } else {
    logger.error('Unexpected error occurred', errorLog);
  }

  // Send error response
  if (error instanceof ApiError) {
    sendError(res, error.message, error.statusCode);
  } else {
    // Unexpected errors
    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? error.message : 'Internal server error';
    sendInternalError(res, message);
  }
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    query: req.query,
  });

  sendError(res, `Cannot ${req.method} ${req.path}`, 404);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
