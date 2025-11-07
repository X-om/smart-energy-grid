/**
 * Prometheus Metrics for Ingestion Service
 * 
 * Tracks key performance indicators:
 * - Request counts (total, success, errors)
 * - Kafka publish latency
 * - Deduplication statistics
 * - HTTP response times
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// Default labels for all metrics
register.setDefaultLabels({
  service: 'ingestion',
});

/**
 * HTTP Request Metrics
 */
export const httpRequestsTotal = new Counter({
  name: 'ingestion_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'ingestion_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

/**
 * Ingestion Success/Error Metrics
 */
export const ingestionSuccessTotal = new Counter({
  name: 'ingestion_success_total',
  help: 'Total number of successfully ingested readings',
  labelNames: ['region'],
  registers: [register],
});

export const ingestionErrorsTotal = new Counter({
  name: 'ingestion_errors_total',
  help: 'Total number of ingestion errors',
  labelNames: ['error_type'],
  registers: [register],
});

/**
 * Validation Metrics
 */
export const validationErrorsTotal = new Counter({
  name: 'ingestion_validation_errors_total',
  help: 'Total number of validation errors',
  labelNames: ['field'],
  registers: [register],
});

/**
 * Deduplication Metrics
 */
export const deduplicatedMessagesTotal = new Counter({
  name: 'deduplicated_messages_total',
  help: 'Total number of duplicate messages filtered',
  registers: [register],
});

export const deduplicationCheckDuration = new Histogram({
  name: 'deduplication_check_duration_ms',
  help: 'Deduplication check duration in milliseconds',
  buckets: [1, 2, 5, 10, 25, 50, 100],
  registers: [register],
});

/**
 * Kafka Producer Metrics
 */
export const kafkaProduceLatency = new Histogram({
  name: 'kafka_produce_latency_ms',
  help: 'Kafka message publish latency in milliseconds',
  labelNames: ['topic'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [register],
});

export const kafkaMessagesPublished = new Counter({
  name: 'kafka_messages_published_total',
  help: 'Total number of messages published to Kafka',
  labelNames: ['topic', 'partition'],
  registers: [register],
});

export const kafkaPublishErrors = new Counter({
  name: 'kafka_publish_errors_total',
  help: 'Total number of Kafka publish errors',
  labelNames: ['topic', 'error_type'],
  registers: [register],
});

/**
 * Batch Processing Metrics
 */
export const batchSizeHistogram = new Histogram({
  name: 'ingestion_batch_size',
  help: 'Distribution of batch sizes received',
  buckets: [1, 10, 50, 100, 250, 500, 1000],
  registers: [register],
});

export const batchProcessingDuration = new Histogram({
  name: 'ingestion_batch_processing_duration_ms',
  help: 'Batch processing duration in milliseconds',
  labelNames: ['batch_size_range'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

/**
 * Service Health Metrics
 */
export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const kafkaConnectionStatus = new Gauge({
  name: 'kafka_connection_status',
  help: 'Kafka connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const serviceUptime = new Gauge({
  name: 'service_uptime_seconds',
  help: 'Service uptime in seconds',
  registers: [register],
});

/**
 * Helper function to determine batch size range label
 */
export function getBatchSizeRange(size: number): string {
  if (size <= 10) return '1-10';
  if (size <= 50) return '11-50';
  if (size <= 100) return '51-100';
  if (size <= 250) return '101-250';
  if (size <= 500) return '251-500';
  return '501+';
}

/**
 * Update service uptime metric
 */
const startTime = Date.now();
export function updateUptime() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  serviceUptime.set(uptimeSeconds);
}

// Update uptime every 10 seconds
setInterval(updateUptime, 10000);

/**
 * Initialize metrics with default values
 */
export function initializeMetrics() {
  // Set initial connection statuses
  redisConnectionStatus.set(0);
  kafkaConnectionStatus.set(0);
  serviceUptime.set(0);
}

// Initialize on module load
initializeMetrics();
