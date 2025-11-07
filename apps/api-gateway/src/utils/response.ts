import { Response } from 'express';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

/**
 * Send successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: any
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };

  res.status(statusCode).json(response);
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 400,
  details?: any
): void {
  const response: ApiResponse = {
    success: false,
    error,
    ...(details && { details }),
  };

  res.status(statusCode).json(response);
}

/**
 * Send not found response
 */
export function sendNotFound(res: Response, message: string = 'Resource not found'): void {
  sendError(res, message, 404);
}

/**
 * Send unauthorized response
 */
export function sendUnauthorized(res: Response, message: string = 'Unauthorized'): void {
  sendError(res, message, 401);
}

/**
 * Send forbidden response
 */
export function sendForbidden(res: Response, message: string = 'Forbidden'): void {
  sendError(res, message, 403);
}

/**
 * Send validation error response
 */
export function sendValidationError(res: Response, errors: any): void {
  const response: ApiResponse = {
    success: false,
    error: 'Validation failed',
    details: errors,
  };

  res.status(422).json(response);
}

/**
 * Send internal server error response
 */
export function sendInternalError(
  res: Response,
  message: string = 'Internal server error'
): void {
  sendError(res, message, 500);
}
