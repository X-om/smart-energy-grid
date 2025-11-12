import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics
} from 'prom-client';
import { logger } from '../utils/logger';

class MetricsService {
  private registry: Registry;

  // Alert counters
  private alertsTotal!: Counter<string>;
  private alertsActiveTotal!: Gauge<string>;

  // Alert detection metrics
  private alertDetectionLatency!: Histogram<string>;

  // Processing metrics
  private messagesProcessedTotal!: Counter<string>;
  private messagesProcessingDuration!: Histogram<string>;
  private messagesProcessingErrors!: Counter<string>;

  // System health metrics
  private kafkaConnectionStatus!: Gauge<string>;
  private postgresConnectionStatus!: Gauge<string>;
  private redisConnectionStatus!: Gauge<string>;

  // Alert rule metrics
  private alertRulesTotal!: Gauge<string>;
  private alertRulesEnabled!: Gauge<string>;
  private alertRuleEvaluations!: Counter<string>;
  private alertRuleEvaluationDuration!: Histogram<string>;

  // API metrics
  private httpRequestsTotal!: Counter<string>;
  private httpRequestDuration!: Histogram<string>; constructor() {
    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry });

    this.initializeMetrics();

    logger.info('Metrics service initialized');
  }

  private initializeMetrics(): void {
    // Alert metrics
    this.alertsTotal = new Counter({
      name: 'alerts_total',
      help: 'Total number of alerts created',
      labelNames: ['type', 'severity', 'region'],
      registers: [this.registry]
    });

    this.alertsActiveTotal = new Gauge({
      name: 'alerts_active_total',
      help: 'Current number of active alerts',
      labelNames: ['type', 'region'],
      registers: [this.registry]
    });

    this.alertDetectionLatency = new Histogram({
      name: 'alert_detection_latency_ms',
      help: 'Time taken to detect and create an alert in milliseconds',
      labelNames: ['type'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry]
    });

    // Message processing metrics
    this.messagesProcessedTotal = new Counter({
      name: 'messages_processed_total',
      help: 'Total number of Kafka messages processed',
      labelNames: ['topic', 'status'],
      registers: [this.registry]
    });

    this.messagesProcessingDuration = new Histogram({
      name: 'messages_processing_duration_ms',
      help: 'Time taken to process Kafka messages in milliseconds',
      labelNames: ['topic'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry]
    });

    this.messagesProcessingErrors = new Counter({
      name: 'messages_processing_errors_total',
      help: 'Total number of message processing errors',
      labelNames: ['topic', 'error_type'],
      registers: [this.registry]
    });

    // Connection status metrics
    this.kafkaConnectionStatus = new Gauge({
      name: 'kafka_connection_status',
      help: 'Kafka connection status (1 = connected, 0 = disconnected)',
      registers: [this.registry]
    });

    this.postgresConnectionStatus = new Gauge({
      name: 'postgres_connection_status',
      help: 'PostgreSQL connection status (1 = connected, 0 = disconnected)',
      registers: [this.registry]
    });

    this.redisConnectionStatus = new Gauge({
      name: 'redis_connection_status',
      help: 'Redis connection status (1 = connected, 0 = disconnected)',
      registers: [this.registry]
    });

    // Alert rule metrics
    this.alertRulesTotal = new Gauge({
      name: 'alert_rules_total',
      help: 'Total number of alert rules configured',
      registers: [this.registry]
    });

    this.alertRulesEnabled = new Gauge({
      name: 'alert_rules_enabled',
      help: 'Number of enabled alert rules',
      registers: [this.registry]
    });

    this.alertRuleEvaluations = new Counter({
      name: 'alert_rule_evaluations_total',
      help: 'Total number of alert rule evaluations',
      labelNames: ['rule_id', 'rule_type', 'result'],
      registers: [this.registry]
    });

    this.alertRuleEvaluationDuration = new Histogram({
      name: 'alert_rule_evaluation_duration_ms',
      help: 'Time taken to evaluate alert rules in milliseconds',
      labelNames: ['rule_id', 'rule_type'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500],
      registers: [this.registry]
    });

    // API metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'path'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry]
    });
  }

  // Alert metrics methods
  incrementAlertsTotal(type: string, severity: string, region?: string): void {
    this.alertsTotal.inc({
      type,
      severity,
      region: region || 'unknown'
    });
  }

  incrementActiveAlerts(type: string, region?: string): void {
    this.alertsActiveTotal.inc({
      type,
      region: region || 'unknown'
    });
  }

  decrementActiveAlerts(type: string, region?: string): void {
    this.alertsActiveTotal.dec({
      type,
      region: region || 'unknown'
    });
  }

  recordAlertDetectionLatency(durationMs: number, type?: string): void {
    this.alertDetectionLatency.observe({
      type: type || 'unknown'
    }, durationMs);
  }

  // Message processing metrics methods
  incrementMessagesProcessed(topic: string, status: 'success' | 'error'): void {
    this.messagesProcessedTotal.inc({ topic, status });
  }

  recordMessageProcessingDuration(topic: string, durationMs: number): void {
    this.messagesProcessingDuration.observe({ topic }, durationMs);
  }

  incrementMessageProcessingErrors(topic: string, errorType: string): void {
    this.messagesProcessingErrors.inc({ topic, error_type: errorType });
  }

  // Connection status methods
  setKafkaConnectionStatus(connected: boolean): void {
    this.kafkaConnectionStatus.set(connected ? 1 : 0);
  }

  setPostgresConnectionStatus(connected: boolean): void {
    this.postgresConnectionStatus.set(connected ? 1 : 0);
  }

  setRedisConnectionStatus(connected: boolean): void {
    this.redisConnectionStatus.set(connected ? 1 : 0);
  }

  // Alert rule metrics methods
  setAlertRulesTotal(count: number): void {
    this.alertRulesTotal.set(count);
  }

  setAlertRulesEnabled(count: number): void {
    this.alertRulesEnabled.set(count);
  }

  incrementAlertRuleEvaluations(ruleId: string, ruleType: string, result: 'triggered' | 'not_triggered'): void {
    this.alertRuleEvaluations.inc({
      rule_id: ruleId,
      rule_type: ruleType,
      result
    });
  }

  recordAlertRuleEvaluationDuration(ruleId: string, ruleType: string, durationMs: number): void {
    this.alertRuleEvaluationDuration.observe({
      rule_id: ruleId,
      rule_type: ruleType
    }, durationMs);
  }

  // API metrics methods
  incrementHttpRequests(method: string, path: string, statusCode: number): void {
    this.httpRequestsTotal.inc({
      method: method.toUpperCase(),
      path,
      status_code: statusCode.toString()
    });
  }

  recordHttpRequestDuration(method: string, path: string, durationMs: number): void {
    this.httpRequestDuration.observe({
      method: method.toUpperCase(),
      path
    }, durationMs);
  }

  // Registry and export methods
  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    try {
      return await this.registry.metrics();
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      throw error;
    }
  }

  async getMetricsAsJson(): Promise<any> {
    try {
      const metrics = await this.registry.getMetricsAsJSON();
      return metrics;
    } catch (error) {
      logger.error('Failed to get metrics as JSON:', error);
      throw error;
    }
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.registry.resetMetrics();
    logger.info('All metrics reset');
  }

  // Custom gauge setters for complex metrics
  setActiveAlertsCount(type: string, region: string, count: number): void {
    this.alertsActiveTotal.set({ type, region }, count);
  }

  // Batch metric updates
  updateConnectionStatuses(kafka: boolean, postgres: boolean, redis: boolean): void {
    this.setKafkaConnectionStatus(kafka);
    this.setPostgresConnectionStatus(postgres);
    this.setRedisConnectionStatus(redis);
  }

  // Helper method to create a timer for duration measurements
  startTimer(histogram: Histogram<string>, labels?: Record<string, string>) {
    const end = histogram.startTimer(labels);
    return end;
  }

  // Create timers for specific metrics
  startAlertDetectionTimer(type?: string) {
    return this.alertDetectionLatency.startTimer({ type: type || 'unknown' });
  }

  startMessageProcessingTimer(topic: string) {
    return this.messagesProcessingDuration.startTimer({ topic });
  }

  startRuleEvaluationTimer(ruleId: string, ruleType: string) {
    return this.alertRuleEvaluationDuration.startTimer({
      rule_id: ruleId,
      rule_type: ruleType
    });
  }

  startHttpRequestTimer(method: string, path: string) {
    return this.httpRequestDuration.startTimer({
      method: method.toUpperCase(),
      path
    });
  }

  // Health check for metrics service
  isHealthy(): boolean {
    try {
      // Simple check - try to get metric count
      const metricFamilies = this.registry.getMetricsAsArray();
      return metricFamilies.length > 0;
    } catch (error) {
      logger.error('Metrics service health check failed:', error);
      return false;
    }
  }

  // Get summary statistics
  getSummary(): Record<string, any> {
    try {
      const metricFamilies = this.registry.getMetricsAsArray();

      return {
        total_metric_families: metricFamilies.length,
        metric_types: metricFamilies.reduce((acc, family) => {
          acc[family.type] = (acc[family.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        registry_type: 'prometheus',
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get metrics summary:', error);
      return {
        error: 'Failed to get summary',
        last_updated: new Date().toISOString()
      };
    }
  }
}

export const metricsService = new MetricsService();