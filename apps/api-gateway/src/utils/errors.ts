/* eslint-disable @typescript-eslint/no-explicit-any */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code?: string, details?: any) {
    super(message, 400, code || 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code?: string, details?: any) {
    super(message, 401, code || 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code?: string, details?: any) {
    super(message, 403, code || 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code?: string, details?: any) {
    super(message, 404, code || 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', code?: string, details?: any) {
    super(message, 409, code || 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', code?: string, details?: any) {
    super(message, 429, code || 'TOO_MANY_REQUESTS', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code?: string, details?: any) {
    super(message, 500, code || 'INTERNAL_SERVER_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', code?: string, details?: any) {
    super(message, 503, code || 'SERVICE_UNAVAILABLE', details);
  }
}

// * Database-specific errors
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: any) {
    super(message, 500, 'DATABASE_ERROR', details, false);
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message: string = 'Database connection failed') {
    super(message, 500, 'DATABASE_CONNECTION_ERROR', undefined, false);
  }
}

// * External service errors
export class ExternalServiceError extends AppError {
  constructor(serviceName: string, message: string = 'External service error', details?: any) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', { service: serviceName, ...details });
  }
}

// * Token-specific errors
export class TokenExpiredError extends UnauthorizedError {
  constructor(message: string = 'Token has expired') { super(message, 'TOKEN_EXPIRED'); }
}

export class TokenInvalidError extends UnauthorizedError {
  constructor(message: string = 'Token is invalid') { super(message, 'TOKEN_INVALID'); }
}

export class TokenBlacklistedError extends UnauthorizedError {
  constructor(message: string = 'Token has been revoked') { super(message, 'TOKEN_BLACKLISTED'); }
}
