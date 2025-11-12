import { Kafka, Producer, Message } from 'kafkajs';
import { createLogger } from '../utils/logger';

const logger = createLogger('kafka-producer');

export interface KafkaProducerConfig {
  brokers: Array<string>;
  clientId: string;
}

export interface ProcessedAlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata: Record<string, any>;
  processing_timestamp: string;
  source: 'alert-service';
}

export class KafkaProducerService {
  private static instance: KafkaProducerService;
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  private constructor(config: KafkaProducerConfig) {
    this.kafka = new Kafka({
      clientId: `${config.clientId}-producer`,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000
    });
  }

  static getInstance(config?: KafkaProducerConfig): KafkaProducerService {
    if (!KafkaProducerService.instance) {
      if (!config) throw new Error('Config required for first initialization');
      KafkaProducerService.instance = new KafkaProducerService(config);
    }
    return KafkaProducerService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka producer');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.connected = false;
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting Kafka producer');
      throw error;
    }
  }

  async publishProcessedAlert(topic: string, alertData: ProcessedAlertMessage): Promise<void> {
    try {
      const message: Message = {
        key: alertData.id,
        value: JSON.stringify(alertData),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'alert-service',
          'alert-type': alertData.type,
          'alert-severity': alertData.severity,
          'alert-status': alertData.status
        }
      };

      if (alertData.region) {
        message.headers!['alert-region'] = alertData.region;
      }

      if (alertData.meter_id) {
        message.headers!['alert-meter-id'] = alertData.meter_id;
      }

      const result = await this.producer.send({
        topic,
        messages: [message]
      });

      logger.info(
        { alertId: alertData.id, type: alertData.type, partition: result[0].partition },
        'Published processed alert'
      );
    } catch (error) {
      logger.error({ error, alertData }, 'Failed to publish processed alert');
      throw error;
    }
  }

  async publishAlertStatusUpdate(
    topic: string,
    alertId: string,
    status: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const updateMessage = {
        alert_id: alertId,
        status,
        timestamp: new Date().toISOString(),
        metadata,
        source: 'alert-service'
      };

      const message: Message = {
        key: alertId,
        value: JSON.stringify(updateMessage),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'alert-service',
          'message-type': 'status-update',
          'alert-status': status
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.info({ alertId, status }, 'Published alert status update');
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to publish alert status update');
      throw error;
    }
  }

  async publishHealthCheck(topic: string, serviceName: string): Promise<void> {
    try {
      const healthMessage = {
        service: serviceName,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      };

      const message: Message = {
        key: `${serviceName}-health`,
        value: JSON.stringify(healthMessage),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'alert-service',
          'message-type': 'health-check'
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.debug('Published health check message');
    } catch (error) {
      logger.error({ error }, 'Failed to publish health check');
    }
  }

  isHealthy(): boolean {
    return this.connected;
  }
}
