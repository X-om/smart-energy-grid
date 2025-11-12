
export type HealthStatus = 'ok' | 'error' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
  version?: string;
  uptime?: number;
  dependencies?: Record<string, DependencyHealth>;
}


export interface DependencyHealth {
  status: HealthStatus;
  responseTime?: number;
  message?: string;
}


export interface KafkaEvent<T> {
  topic: string;
  key?: string;
  value: T;
  timestamp: string;
  type?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}


export interface RedisKey<T> {
  key: string;
  value: T;
  ttl?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  code: string;
  timestamp: string;
  path?: string;
  errors?: ValidationError[];
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface ServiceConfig {
  name: string;
  port: number;
  environment: string;

  logLevel: 'debug' | 'info' | 'warn' | 'error';
  kafkaBrokers?: string[];
  databaseUrl?: string;
  redisUrl?: string;
}

export interface WebSocketMessage<T> {
  type: string;
  data: T;
  timestamp: string;
  correlationId?: string;
}

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
