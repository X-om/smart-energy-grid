import { register, Counter, Gauge, Histogram } from 'prom-client';
import { metricsLogger as logger } from '../utils/logger.js';

class MetricsService {
  // WebSocket connection metrics
  public wsConnectionsTotal!: Gauge;
  public wsConnectionsActive!: Gauge;
  public wsMessagesSentTotal!: Counter;
  public wsMessagesReceivedTotal!: Counter;
  public wsBroadcastLatencyMs!: Histogram;
  public wsAuthFailuresTotal!: Counter;

  // Kafka consumer metrics
  public kafkaMessagesConsumedTotal!: Counter;
  public kafkaMessagesProcessingDurationMs!: Histogram;
  public kafkaMessagesProcessingErrorsTotal!: Counter;

  // Channel subscription metrics
  public channelSubscribersGauge!: Gauge;

  // Connection status
  public kafkaConnectionStatus!: Gauge;

  // System metrics
  public httpRequestsTotal!: Counter;
  public httpRequestDurationMs!: Histogram;

  constructor() {
    this.initializeMetrics();
    logger.info('Metrics service initialized');
  }

  private initializeMetrics(): void {
    // WebSocket connection metrics
    this.wsConnectionsTotal = new Gauge({
      name: 'ws_connections_total',
      help: 'Total number of WebSocket connections ever established'
    });

    this.wsConnectionsActive = new Gauge({
      name: 'ws_connections_active',
      help: 'Current number of active WebSocket connections'
    });

    this.wsMessagesSentTotal = new Counter({
      name: 'ws_messages_sent_total',
      help: 'Total number of messages sent to WebSocket clients',
      labelNames: ['topic', 'channel']
    });

    this.wsMessagesReceivedTotal = new Counter({
      name: 'ws_messages_received_total',
      help: 'Total number of messages received from WebSocket clients',
      labelNames: ['type']
    });

    this.wsBroadcastLatencyMs = new Histogram({
      name: 'ws_broadcast_latency_ms',
      help: 'Time taken to broadcast a message to all subscribers in milliseconds',
      labelNames: ['channel'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000]
    });

    this.wsAuthFailuresTotal = new Counter({
      name: 'ws_auth_failures_total',
      help: 'Total number of WebSocket authentication failures',
      labelNames: ['reason']
    });

    // Kafka consumer metrics
    this.kafkaMessagesConsumedTotal = new Counter({
      name: 'kafka_messages_consumed_total',
      help: 'Total number of Kafka messages consumed',
      labelNames: ['topic']
    });

    this.kafkaMessagesProcessingDurationMs = new Histogram({
      name: 'kafka_messages_processing_duration_ms',
      help: 'Time taken to process Kafka messages in milliseconds',
      labelNames: ['topic'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
    });

    this.kafkaMessagesProcessingErrorsTotal = new Counter({
      name: 'kafka_messages_processing_errors_total',
      help: 'Total number of Kafka message processing errors',
      labelNames: ['topic', 'error_type']
    });

    // Channel subscription metrics
    this.channelSubscribersGauge = new Gauge({
      name: 'channel_subscribers_total',
      help: 'Number of subscribers per channel',
      labelNames: ['channel']
    });

    // Connection status
    this.kafkaConnectionStatus = new Gauge({
      name: 'kafka_connection_status',
      help: 'Kafka connection status (1 = connected, 0 = disconnected)'
    });

    // System metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code']
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'path'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
    });
  }

  // WebSocket metrics methods
  incrementConnectionsTotal(): void {
    this.wsConnectionsTotal.inc();
  }

  setActiveConnections(count: number): void {
    this.wsConnectionsActive.set(count);
  }

  incrementMessagesSent(topic: string, channel: string): void {
    this.wsMessagesSentTotal.inc({ topic, channel });
  }

  incrementMessagesReceived(type: string): void {
    this.wsMessagesReceivedTotal.inc({ type });
  }

  recordBroadcastLatency(channel: string, durationMs: number): void {
    this.wsBroadcastLatencyMs.observe({ channel }, durationMs);
  }

  incrementAuthFailures(reason: string): void {
    this.wsAuthFailuresTotal.inc({ reason });
  }

  // Kafka metrics methods
  incrementKafkaMessagesConsumed(topic: string): void {
    this.kafkaMessagesConsumedTotal.inc({ topic });
  }

  recordKafkaProcessingDuration(topic: string, durationMs: number): void {
    this.kafkaMessagesProcessingDurationMs.observe({ topic }, durationMs);
  }

  incrementKafkaProcessingErrors(topic: string, errorType: string): void {
    this.kafkaMessagesProcessingErrorsTotal.inc({ topic, error_type: errorType });
  }

  // Channel metrics methods
  updateChannelSubscribers(channel: string, count: number): void {
    this.channelSubscribersGauge.set({ channel }, count);
  }

  // Connection status methods
  setKafkaConnectionStatus(connected: boolean): void {
    this.kafkaConnectionStatus.set(connected ? 1 : 0);
  }

  // HTTP metrics methods
  incrementHttpRequests(method: string, path: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, path, status_code: statusCode.toString() });
  }

  recordHttpRequestDuration(method: string, path: string, durationMs: number): void {
    this.httpRequestDurationMs.observe({ method, path }, durationMs);
  }

  // Get all metrics
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    register.clear();
    this.initializeMetrics();
  }
}

export const metricsService = new MetricsService();
