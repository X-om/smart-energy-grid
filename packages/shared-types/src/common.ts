/**
 * Common utility types and interfaces used across all services.
 */

/**
 * Health check response status.
 */
export type HealthStatus = 'ok' | 'error' | 'degraded';

/**
 * Standard health check response format.
 * All services should expose a /health endpoint returning this structure.
 */
export interface HealthResponse {
  /** Overall health status of the service */
  status: HealthStatus;

  /** Name of the service */
  service: string;

  /** ISO 8601 timestamp of the health check */
  timestamp: string;

  /** Service version */
  version?: string;

  /** Uptime in seconds */
  uptime?: number;

  /** Detailed health of dependencies (databases, message brokers, etc.) */
  dependencies?: Record<string, DependencyHealth>;
}

/**
 * Health status of a service dependency.
 */
export interface DependencyHealth {
  /** Status of the dependency */
  status: HealthStatus;

  /** Optional response time in milliseconds */
  responseTime?: number;

  /** Optional error message if unhealthy */
  message?: string;
}

/**
 * Generic Kafka event wrapper.
 * Provides consistent structure for all messages published to Kafka topics.
 */
export interface KafkaEvent<T> {
  /** Kafka topic name */
  topic: string;

  /** Optional message key for partitioning */
  key?: string;

  /** Event payload */
  value: T;

  /** ISO 8601 timestamp when the event was created */
  timestamp: string;

  /** Optional event type/schema identifier */
  type?: string;

  /** Optional correlation ID for distributed tracing */
  correlationId?: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generic Redis key-value structure.
 * Provides type-safe wrapper for Redis operations.
 */
export interface RedisKey<T> {
  /** Redis key */
  key: string;

  /** Value stored in Redis */
  value: T;

  /** Optional TTL in seconds */
  ttl?: number;
}

/**
 * Pagination parameters for list endpoints.
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Optional sort field */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];

  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;

    /** Items per page */
    limit: number;

    /** Total number of items */
    total: number;

    /** Total number of pages */
    totalPages: number;

    /** Whether there is a next page */
    hasNext: boolean;

    /** Whether there is a previous page */
    hasPrev: boolean;
  };
}

/**
 * Standard API error response format.
 */
export interface ErrorResponse {
  /** HTTP status code */
  statusCode: number;

  /** Error message */
  message: string;

  /** Error code for client handling */
  code: string;

  /** ISO 8601 timestamp of the error */
  timestamp: string;

  /** Request path that caused the error */
  path?: string;

  /** Validation errors (if applicable) */
  errors?: ValidationError[];

  /** Stack trace (only in development) */
  stack?: string;
}

/**
 * Validation error detail.
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;

  /** Validation error message */
  message: string;

  /** Actual value that was provided */
  value?: unknown;
}

/**
 * Time range filter for queries.
 */
export interface TimeRange {
  /** Start of the time range (ISO 8601) */
  start: string;

  /** End of the time range (ISO 8601) */
  end: string;
}

/**
 * Generic service configuration.
 */
export interface ServiceConfig {
  /** Service name */
  name: string;

  /** Service port */
  port: number;

  /** Environment (development, staging, production) */
  environment: string;

  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /** Kafka broker URLs */
  kafkaBrokers?: string[];

  /** Database connection string */
  databaseUrl?: string;

  /** Redis connection string */
  redisUrl?: string;
}

/**
 * WebSocket message wrapper.
 */
export interface WebSocketMessage<T> {
  /** Message type/event name */
  type: string;

  /** Message payload */
  data: T;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Optional correlation ID */
  correlationId?: string;
}

/**
 * Type guard to check if an object is a valid HealthResponse
 */
export function isHealthResponse(obj: unknown): obj is HealthResponse {
  const health = obj as HealthResponse;
  return (
    typeof health === 'object' &&
    health !== null &&
    typeof health.status === 'string' &&
    typeof health.service === 'string' &&
    typeof health.timestamp === 'string'
  );
}

/**
 * Type guard to check if an object is a valid KafkaEvent
 */
export function isKafkaEvent<T>(obj: unknown): obj is KafkaEvent<T> {
  const event = obj as KafkaEvent<T>;
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.topic === 'string' &&
    event.value !== undefined &&
    typeof event.timestamp === 'string'
  );
}

/**
 * Type guard to check if an object is a valid ErrorResponse
 */
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  const error = obj as ErrorResponse;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof error.statusCode === 'number' &&
    typeof error.message === 'string' &&
    typeof error.code === 'string'
  );
}
