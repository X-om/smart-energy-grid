/**
 * Prometheus Metrics for Stream Processor
 * 
 * Tracks processing performance and system health
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// Default labels
register.setDefaultLabels({
  service: 'stream-processor',
});

/**
 * Message Processing Metrics
 */
export const streamMessagesTotal = new Counter({
  name: 'stream_messages_total',
  help: 'Total number of messages consumed from Kafka',
  labelNames: ['topic'],
  registers: [register],
});

export const streamMessageProcessingDuration = new Histogram({
  name: 'stream_message_processing_duration_ms',
  help: 'Message processing duration in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250],
  registers: [register],
});

/**
 * Aggregation Metrics
 */
export const streamAggregatesWrittenTotal = new Counter({
  name: 'stream_aggregates_written_total',
  help: 'Total number of aggregates written to TimescaleDB',
  labelNames: ['window_type'], // '1m' or '15m'
  registers: [register],
});

export const streamAggregatesPublishedTotal = new Counter({
  name: 'stream_aggregates_published_total',
  help: 'Total number of aggregates published to Kafka',
  labelNames: ['window_type'],
  registers: [register],
});

export const streamAggregationFlushDuration = new Histogram({
  name: 'stream_aggregation_flush_duration_ms',
  help: 'Time taken to flush aggregates',
  labelNames: ['window_type'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

/**
 * Anomaly Detection Metrics
 */
export const streamAnomaliesDetectedTotal = new Counter({
  name: 'stream_anomalies_detected_total',
  help: 'Total number of anomalies detected',
  labelNames: ['type', 'severity'], // type: spike|drop|outage, severity: INFO|WARN|ERROR
  registers: [register],
});

export const streamAlertsPublishedTotal = new Counter({
  name: 'stream_alerts_published_total',
  help: 'Total number of alerts published to Kafka',
  registers: [register],
});

/**
 * Database Metrics
 */
export const dbWriteLatency = new Histogram({
  name: 'db_write_latency_ms',
  help: 'Database write latency in milliseconds',
  labelNames: ['operation'], // 'upsert_1m' | 'upsert_15m'
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [register],
});

export const dbWriteErrorsTotal = new Counter({
  name: 'db_write_errors_total',
  help: 'Total number of database write errors',
  labelNames: ['operation'],
  registers: [register],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'], // 'total' | 'idle' | 'waiting'
  registers: [register],
});

/**
 * Kafka Metrics
 */
export const streamLagSeconds = new Gauge({
  name: 'stream_lag_seconds',
  help: 'Consumer lag in seconds (time behind latest message)',
  registers: [register],
});

export const kafkaPublishErrorsTotal = new Counter({
  name: 'kafka_publish_errors_total',
  help: 'Total number of Kafka publish errors',
  labelNames: ['topic'],
  registers: [register],
});

/**
 * Windowing Metrics
 */
export const streamWindowedReadingsGauge = new Gauge({
  name: 'stream_windowed_readings',
  help: 'Current number of readings in windows',
  labelNames: ['window_type'],
  registers: [register],
});

export const streamWindowBucketsGauge = new Gauge({
  name: 'stream_window_buckets',
  help: 'Current number of time buckets in memory',
  labelNames: ['window_type'],
  registers: [register],
});

/**
 * Service Health Metrics
 */
export const kafkaConsumerConnected = new Gauge({
  name: 'kafka_consumer_connected',
  help: 'Kafka consumer connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const kafkaProducerConnected = new Gauge({
  name: 'kafka_producer_connected',
  help: 'Kafka producer connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const timescaledbConnected = new Gauge({
  name: 'timescaledb_connected',
  help: 'TimescaleDB connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const serviceUptime = new Gauge({
  name: 'service_uptime_seconds',
  help: 'Service uptime in seconds',
  registers: [register],
});

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
  kafkaConsumerConnected.set(0);
  kafkaProducerConnected.set(0);
  timescaledbConnected.set(0);
  serviceUptime.set(0);
  streamLagSeconds.set(0);
}

// Initialize on module load
initializeMetrics();
