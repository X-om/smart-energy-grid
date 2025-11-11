/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';

export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    stack?: string;
  };
}

// * Send success response
export const successResponse = <T = any>(res: Response, statusCode: number, message: string, data: T, meta?: SuccessResponse['meta']): void => {
  const response: SuccessResponse<T> = { success: true, message, data };
  if (meta) response.meta = meta;

  res.status(statusCode).json(response);
};

// * Send error response
export const errorResponse = (res: Response, statusCode: number, message: string, code?: string, details?: any, stack?: string): void => {
  const response: ErrorResponse = { success: false, error: { message, code, details } };
  if (process.env.NODE_ENV === 'development' && stack) response.error.stack = stack;

  res.status(statusCode).json(response);
};

// * Send paginated response
export const paginatedResponse = <T = any>(res: Response, statusCode: number, message: string, data: T[], page: number, limit: number, total: number): void => {
  const totalPages = Math.ceil(total / limit);
  successResponse(res, statusCode, message, data, { page, limit, total, totalPages });
};

// * Send created response (201)
export const createdResponse = <T = any>(res: Response, message: string, data: T): void =>
  void successResponse(res, 201, message, data);

// * Send no content response (204)
export const noContentResponse = (res: Response): void =>
  void res.status(204).send();

// * Send accepted response (202)
export const acceptedResponse = <T = any>(res: Response, message: string, data?: T): void =>
  void successResponse(res, 202, message, data || {});
