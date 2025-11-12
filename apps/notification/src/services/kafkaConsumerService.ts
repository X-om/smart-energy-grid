import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { createLogger } from '../utils/logger';

const logger = createLogger('kafka-consumer');

export interface KafkaConsumerConfig {
  brokers: Array<string>;
  clientId: string;
  groupId: string;
  topics: Array<string>;
}

// Alert message from alert service (alerts_processed topic)
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
  metadata: Record<string, unknown>;
  processing_timestamp: string;
  source: 'alert-service';
}

// Alert status update message (alert_status_updates topic)
export interface AlertStatusUpdateMessage {
  alert_id: string;
  status: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  source: 'alert-service';
}

// Tariff update message from tariff service (tariff_updates topic)
export interface TariffUpdateMessage {
  tariffId: string;
  region: string;
  pricePerKwh: number;
  effectiveFrom: string;
  reason?: string;
  triggeredBy: string;
  oldPrice?: number;
}

// Billing update message from API gateway (billing_updates topic)
export interface BillingUpdateMessage {
  invoice_id: string;
  user_id: number;
  meter_id: string;
  region: string;
  billing_period: string;
  consumption_kwh: number;
  tariff_rate: number;
  base_cost: number;
  tax_amount: number;
  total_cost: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  generated_at: string;
  source: 'api-gateway';
}

// Payment update message from API gateway (payment_updates topic)
export interface PaymentUpdateMessage {
  transaction_id: string;
  invoice_id: string;
  user_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  timestamp: string;
  reference_number?: string;
  source: 'api-gateway';
}

// Dispute update message from API gateway (dispute_updates topic)
export interface DisputeUpdateMessage {
  dispute_id: string;
  invoice_id: string;
  user_id: number;
  status: 'open' | 'under_review' | 'resolved' | 'rejected';
  reason: string;
  description?: string;
  created_at: string;
  updated_at: string;
  resolved_by?: string;
  resolution?: string;
  source: 'api-gateway';
}

export type MessageHandler = (
  topic: string,
  message: ProcessedAlertMessage | AlertStatusUpdateMessage | TariffUpdateMessage | BillingUpdateMessage | PaymentUpdateMessage | DisputeUpdateMessage
) => Promise<void>;

export class KafkaConsumerService {
  private static instance: KafkaConsumerService;
  private kafka: Kafka;
  private consumer: Consumer;
  private topics: Array<string>;
  private messageHandler: MessageHandler | null = null;
  private connected: boolean = false;

  private constructor(config: KafkaConsumerConfig) {
    this.topics = config.topics;

    this.kafka = new Kafka({
      clientId: config.clientId, brokers: config.brokers,
      retry: { initialRetryTime: 100, retries: 8 },
      logLevel: this.getKafkaLogLevel()
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000, heartbeatInterval: 3000,
      maxWaitTimeInMs: 100, allowAutoTopicCreation: false
    });

    this.setupEventHandlers();
  }

  static getInstance(config?: KafkaConsumerConfig): KafkaConsumerService {
    if (!KafkaConsumerService.instance) {
      if (!config) throw new Error('Config required for first initialization');
      KafkaConsumerService.instance = new KafkaConsumerService(config);
    }
    return KafkaConsumerService.instance;
  }

  private getKafkaLogLevel(): number {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const levelMap: Record<string, number> = { error: 1, warn: 2, info: 4, debug: 5 };

    return levelMap[logLevel] || 4;
  }

  private setupEventHandlers(): void {
    this.consumer.on('consumer.connect', () => {
      this.connected = true;
      logger.info('Kafka consumer connected');
    });

    this.consumer.on('consumer.disconnect', () => {
      this.connected = false;
      logger.warn('Kafka consumer disconnected');
    });

    this.consumer.on('consumer.group_join', ({ payload }) => {
      logger.info({
        groupId: payload.groupId, memberId: payload.memberId, isLeader: payload.isLeader
      }, 'Kafka consumer joined group');
    });

    this.consumer.on('consumer.crash', ({ payload }) => {
      this.connected = false;
      logger.error({ error: payload.error, groupId: payload.groupId }, 'Kafka consumer crashed');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      logger.info('Kafka consumer connected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka consumer');
      throw error;
    }
  }

  async subscribe(): Promise<void> {
    try {
      for (const topic of this.topics) {
        await this.consumer.subscribe({ topic: topic.trim(), fromBeginning: false });
        logger.info({ topic: topic.trim() }, 'Subscribed to topic');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to subscribe to topics');
      throw error;
    }
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async startConsuming(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => await this.handleMessage(payload)
      });

      logger.info({ topics: this.topics }, 'Kafka consumer started consuming messages');
    } catch (error) {
      logger.error({ error }, 'Failed to start consuming messages');
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    try {
      if (!message.value)
        return logger.warn({ topic, partition, offset: message.offset }, 'Empty message value');

      const messageValue = message.value.toString();
      const parsedMessage = JSON.parse(messageValue);

      logger.debug({ topic, partition, offset: message.offset, size: messageValue.length }, 'Processing message');
      if (this.messageHandler) await this.messageHandler(topic, parsedMessage);

      logger.debug({ topic, partition, offset: message.offset }, 'Message processed successfully');
    } catch (error) {
      logger.error({ error, topic, partition, offset: message.offset }, 'Error processing message');
    }
  }

  isHealthy(): boolean { return this.connected; }

  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      this.connected = false;

      logger.info('Kafka consumer disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting Kafka consumer');
      throw error;
    }
  }
}
