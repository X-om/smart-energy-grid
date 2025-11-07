import { Kafka, Producer, Message } from 'kafkajs';
import { kafkaLogger as logger } from '../utils/logger.js';

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

class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'alert-service-producer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 3
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      logger.info('Kafka producer connected');
      this.isConnected = true;
    });

    this.producer.on('producer.disconnect', () => {
      logger.warn('Kafka producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', (event) => {
      logger.error('Kafka producer request timeout:', event.payload);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka producer:', error);
      throw error;
    }
  }

  async publishProcessedAlert(alertData: ProcessedAlertMessage): Promise<void> {
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
        topic: 'alerts_processed',
        messages: [message]
      });

      logger.info('Published processed alert', {
        alertId: alertData.id,
        type: alertData.type,
        status: alertData.status,
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

    } catch (error) {
      logger.error('Failed to publish processed alert:', error);
      throw error;
    }
  }

  async publishAlertStatusUpdate(alertId: string, status: string, metadata: Record<string, any> = {}): Promise<void> {
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

      const result = await this.producer.send({
        topic: 'alert_status_updates',
        messages: [message]
      });

      logger.info('Published alert status update', {
        alertId,
        status,
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

    } catch (error) {
      logger.error('Failed to publish alert status update:', error);
      throw error;
    }
  }

  async publishBulkAlerts(alerts: ProcessedAlertMessage[]): Promise<void> {
    try {
      const messages: Message[] = alerts.map(alert => ({
        key: alert.id,
        value: JSON.stringify(alert),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'alert-service',
          'alert-type': alert.type,
          'alert-severity': alert.severity,
          'alert-status': alert.status,
          ...(alert.region && { 'alert-region': alert.region }),
          ...(alert.meter_id && { 'alert-meter-id': alert.meter_id })
        }
      }));

      const result = await this.producer.send({
        topic: 'alerts_processed',
        messages
      });

      logger.info('Published bulk alerts', {
        count: alerts.length,
        partitions: result.map(r => r.partition),
        firstOffset: result[0]?.baseOffset
      });

    } catch (error) {
      logger.error('Failed to publish bulk alerts:', error);
      throw error;
    }
  }

  async publishHealthCheck(): Promise<void> {
    try {
      const healthMessage = {
        service: 'alert-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      };

      const message: Message = {
        key: 'alert-service-health',
        value: JSON.stringify(healthMessage),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'alert-service',
          'message-type': 'health-check'
        }
      };

      await this.producer.send({
        topic: 'service_health',
        messages: [message]
      });

      logger.debug('Published health check message');

    } catch (error) {
      logger.error('Failed to publish health check:', error);
      // Don't throw error for health checks
    }
  }

  async sendTestMessage(): Promise<void> {
    try {
      const testMessage = {
        service: 'alert-service',
        message: 'Test message from alert service',
        timestamp: new Date().toISOString()
      };

      const message: Message = {
        key: 'test',
        value: JSON.stringify(testMessage),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'alert-service',
          'message-type': 'test'
        }
      };

      const result = await this.producer.send({
        topic: 'alerts_processed',
        messages: [message]
      });

      logger.info('Published test message', {
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

    } catch (error) {
      logger.error('Failed to publish test message:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  async flushMessages(): Promise<void> {
    try {
      await this.producer.send({
        topic: 'alerts_processed',
        messages: []
      });
      logger.info('Flushed producer messages');
    } catch (error) {
      logger.error('Failed to flush producer messages:', error);
      throw error;
    }
  }

  async getProducerMetadata() {
    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const metadata = await admin.fetchTopicMetadata({
        topics: ['alerts_processed', 'alert_status_updates', 'service_health']
      });

      await admin.disconnect();

      return metadata;
    } catch (error) {
      logger.error('Failed to get producer metadata:', error);
      return null;
    }
  }
}

export const kafkaProducer = new KafkaProducer();