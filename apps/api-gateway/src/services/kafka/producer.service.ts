import { Kafka, Producer, Message } from 'kafkajs';
import { BillingUpdateMessage, PaymentUpdateMessage, DisputeUpdateMessage } from '@segs/shared-types';
import { logger } from '../../utils/logger';

export interface KafkaProducerConfig {
  brokers: Array<string>;
  clientId: string;
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
        retries: 8,
        multiplier: 2,
        maxRetryTime: 30000
      }
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000
    });

    this.setupEventHandlers();
  }

  static getInstance(config?: KafkaProducerConfig): KafkaProducerService {
    if (!KafkaProducerService.instance) {
      if (!config) throw new Error('Config required for first initialization');
      KafkaProducerService.instance = new KafkaProducerService(config);
    }
    return KafkaProducerService.instance;
  }

  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      this.connected = true;
      logger.info('Kafka producer connected');
    });

    this.producer.on('producer.disconnect', () => {
      this.connected = false;
      logger.warn('Kafka producer disconnected');
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      logger.error({ payload }, 'Kafka producer request timeout');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer ready');
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

  async publishBillingUpdate(topic: string, billing: BillingUpdateMessage): Promise<void> {
    try {
      const message: Message = {
        key: billing.invoice_id,
        value: JSON.stringify(billing),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'api-gateway',
          'message-type': 'billing-update',
          'user-id': billing.user_id.toString(),
          'invoice-status': billing.status,
          'region': billing.region
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.info(
        { invoiceId: billing.invoice_id, userId: billing.user_id, status: billing.status },
        'Published billing update'
      );
    } catch (error) {
      logger.error({ error, billing }, 'Failed to publish billing update');
      throw error;
    }
  }

  async publishPaymentUpdate(topic: string, payment: PaymentUpdateMessage): Promise<void> {
    try {
      const message: Message = {
        key: payment.transaction_id,
        value: JSON.stringify(payment),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'api-gateway',
          'message-type': 'payment-update',
          'user-id': payment.user_id.toString(),
          'payment-status': payment.status,
          'invoice-id': payment.invoice_id
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.info(
        { transactionId: payment.transaction_id, userId: payment.user_id, status: payment.status },
        'Published payment update'
      );
    } catch (error) {
      logger.error({ error, payment }, 'Failed to publish payment update');
      throw error;
    }
  }

  async publishDisputeUpdate(topic: string, dispute: DisputeUpdateMessage): Promise<void> {
    try {
      const message: Message = {
        key: dispute.dispute_id,
        value: JSON.stringify(dispute),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'source': 'api-gateway',
          'message-type': 'dispute-update',
          'user-id': dispute.user_id.toString(),
          'dispute-status': dispute.status,
          'invoice-id': dispute.invoice_id
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.info(
        { disputeId: dispute.dispute_id, userId: dispute.user_id, status: dispute.status },
        'Published dispute update'
      );
    } catch (error) {
      logger.error({ error, dispute }, 'Failed to publish dispute update');
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.connected;
  }
}
