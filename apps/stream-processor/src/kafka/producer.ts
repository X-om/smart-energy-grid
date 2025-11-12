import { Kafka, Producer, Partitioners } from 'kafkajs';
import { createLogger } from '../utils/logger';
import type { Aggregate1m, Aggregate15m, RegionalAggregate1m } from '../db/timescale';

const logger = createLogger('kafka-producer');

export interface KafkaProducerConfig {
  brokers: Array<string>;
  clientId: string;
}

export interface Alert {
  id: string;
  type: 'ANOMALY' | 'OVERLOAD' | 'OUTAGE';
  severity: 'low' | 'medium' | 'high' | 'critical';
  meter_id: string;
  region: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class KafkaProducerService {
  private static instance: KafkaProducerService;
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  private constructor(config: KafkaProducerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId, brokers: config.brokers, retry: { initialRetryTime: 300, retries: 8, multiplier: 2, maxRetryTime: 30000 },
      logLevel: this.getKafkaLogLevel()
    });

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner, allowAutoTopicCreation: true, retry: { initialRetryTime: 300, retries: 5, multiplier: 2, maxRetryTime: 30000 }
    });
    this.setupEventHandlers();
  }

  static getInstance(config?: KafkaProducerConfig): KafkaProducerService {
    if (!KafkaProducerService.instance && config) KafkaProducerService.instance = new KafkaProducerService(config);
    if (!KafkaProducerService.instance) throw new Error('KafkaProducerService must be initialized with config first');
    return KafkaProducerService.instance;
  }

  //  * Get Kafka log level from environment
  private getKafkaLogLevel() {
    const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    const levels: Record<string, number> = { debug: 5, info: 4, warn: 2, error: 1 };
    return levels[logLevel] || 4;
  }

  //  * Setup event handlers
  private setupEventHandlers() {
    this.producer.on('producer.connect', () => {
      this.connected = true; logger.info('Kafka producer connected');
    });

    this.producer.on('producer.disconnect', () => {
      this.connected = false;
      logger.info('Kafka producer disconnected');
    });

    this.producer.on('producer.network.request_timeout', (payload) => logger.warn({ payload }, 'Kafka request timeout'));
  }

  // * Connect to Kafka
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer ready');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka producer');
      throw error;
    }
  }

  // * Publish 1-minute aggregates
  async publishAggregates1m(aggregates: Array<Aggregate1m>, topic: string): Promise<number> {
    try {
      if (!this.connected || aggregates.length === 0) return 0;

      const messages = aggregates.map((agg) => ({
        key: agg.meterId, value: JSON.stringify({
          meterId: agg.meterId, region: agg.region, windowStart: agg.windowStart,
          avgPowerKw: agg.avgPowerKw, maxPowerKw: agg.maxPowerKw, energyKwhSum: agg.energyKwhSum, count: agg.count
        }), headers: { type: '1m_aggregate', region: agg.region }
      }));
      await this.producer.send({ topic, messages });
      logger.debug({ count: aggregates.length, topic }, 'Published 1m aggregates');

      return aggregates.length;
    } catch (error) {
      logger.error({ error, count: aggregates.length }, 'Failed to publish 1m aggregates');
      return 0;
    }
  }

  // * Publish 15-minute aggregates
  async publishAggregates15m(aggregates: Aggregate15m[], topic: string): Promise<number> {
    try {
      if (!this.connected || aggregates.length === 0) return 0;

      const messages = aggregates.map((agg) => ({
        key: agg.meterId, value: JSON.stringify({
          meterId: agg.meterId, region: agg.region, windowStart: agg.windowStart,
          avgPowerKw: agg.avgPowerKw, maxPowerKw: agg.maxPowerKw, energyKwhSum: agg.energyKwhSum, count: agg.count,
        }), headers: { type: '15m_aggregate', region: agg.region }
      }));
      await this.producer.send({ topic, messages });
      logger.debug({ count: aggregates.length, topic }, 'Published 15m aggregates');

      return aggregates.length;
    } catch (error) {
      logger.error({ error, count: aggregates.length }, 'Failed to publish 15m aggregates');
      return 0;
    }
  }

  // * Publish regional 1-minute aggregates
  async publishRegionalAggregates1m(aggregates: Array<RegionalAggregate1m>, topic: string): Promise<number> {
    try {
      if (!this.connected || aggregates.length === 0) return 0;

      const messages = aggregates.map((agg) => ({
        key: agg.region,
        value: JSON.stringify({
          region: agg.region,
          timestamp: agg.timestamp,
          meter_count: agg.meterCount,
          total_consumption: agg.totalConsumption,
          avg_consumption: agg.avgConsumption,
          max_consumption: agg.maxConsumption,
          min_consumption: agg.minConsumption,
          load_percentage: agg.loadPercentage,
          active_meters: agg.activeMeters,
        }),
        headers: { type: 'regional_1m_aggregate', region: agg.region },
      }));

      await this.producer.send({ topic, messages });
      logger.debug({ count: aggregates.length, topic }, 'Published regional 1m aggregates');

      return aggregates.length;
    } catch (error) {
      logger.error({ error, count: aggregates.length }, 'Failed to publish regional 1m aggregates');
      return 0;
    }
  }

  // * Publish alert
  async publishAlert(alert: Alert, topic: string): Promise<boolean> {
    try {
      if (!this.connected) return false;
      await this.producer.send({
        topic, messages: [{
          key: alert.meter_id, value: JSON.stringify(alert),
          headers: { type: alert.type, severity: alert.severity, region: alert.region }
        }]
      });

      logger.info({ alertId: alert.id, type: alert.type, severity: alert.severity, meterId: alert.meter_id, }, 'Published alert');
      return true;
    } catch (error) {
      logger.error({ error, alert }, 'Failed to publish alert');
      return false;
    }
  }

  // * Publish batch of alerts
  async publishAlerts(alerts: Alert[], topic: string): Promise<number> {
    try {
      if (!this.connected || alerts.length === 0) return 0;
      const messages = alerts.map((alert) => ({
        key: alert.meter_id, value: JSON.stringify(alert),
        headers: { type: alert.type, severity: alert.severity, region: alert.region }
      }));

      await this.producer.send({ topic, messages });
      logger.info({ count: alerts.length, topic }, 'Published alerts');

      return alerts.length;
    } catch (error) {
      logger.error({ error, count: alerts.length }, 'Failed to publish alerts');
      return 0;
    }
  }

  // * Get connection status
  isConnected(): boolean { return this.connected; }

  // * Gracefully disconnect
  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.producer.disconnect();
        logger.info('Disconnected from Kafka');
      }
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Kafka');
    }
  }
}
