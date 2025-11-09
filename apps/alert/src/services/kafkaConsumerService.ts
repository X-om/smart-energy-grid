import { Kafka, Consumer, EachMessagePayload, ConsumerCrashEvent } from 'kafkajs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('kafka-consumer');

export interface KafkaConsumerConfig {
  brokers: Array<string>;
  clientId: string;
  groupId: string;
  topics: Array<string>;
}

export interface RegionalAggregateMessage {
  region: string;
  timestamp: string;
  meter_count: number;
  total_consumption: number;
  avg_consumption: number;
  max_consumption: number;
  min_consumption: number;
  load_percentage: number;
  active_meters: string[];
}

export interface AnomalyAlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type MessageHandler = (topic: string, message: RegionalAggregateMessage | AnomalyAlertMessage) => Promise<void>;

export class KafkaConsumerService {
  private static instance: KafkaConsumerService;
  private kafka: Kafka;
  private consumer: Consumer;
  private config: KafkaConsumerConfig;
  private connected: boolean = false;
  private messageHandler?: MessageHandler;

  private constructor(config: KafkaConsumerConfig) {
    this.config = config;

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        multiplier: 2,
        maxRetryTime: 30000
      },
      logLevel: this.getKafkaLogLevel()
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
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

  private getKafkaLogLevel() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const levelMap: Record<string, number> = { error: 1, warn: 2, info: 4, debug: 5 };
    return levelMap[logLevel] || 4;
  }

  private setupEventHandlers() {
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected');
    });

    this.consumer.on('consumer.disconnect', () => {
      this.connected = false;
      logger.warn('Kafka consumer disconnected');
    });

    this.consumer.on('consumer.crash', (event: ConsumerCrashEvent) => {
      const error = event.payload?.error || new Error('Consumer crashed');
      this.connected = false;
      logger.error({ error }, 'Kafka consumer crashed');
    });

    this.consumer.on('consumer.group_join', ({ payload }) => {
      logger.info(
        { groupId: payload.groupId, memberId: payload.memberId },
        'Joined consumer group'
      );
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: this.config.topics,
        fromBeginning: false
      });

      this.connected = true;
      logger.info({ topics: this.config.topics }, 'Kafka consumer subscribed to topics');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka consumer');
      throw error;
    }
  }

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

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async startConsuming(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        }
      });

      logger.info('Kafka consumer started consuming messages');
    } catch (error) {
      logger.error({ error }, 'Failed to start consuming messages');
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn({ topic, partition }, 'Received empty message');
        return;
      }

      const messageValue = message.value.toString();
      const parsedMessage = JSON.parse(messageValue);

      logger.debug(
        { topic, partition, offset: message.offset },
        'Processing message'
      );

      if (this.messageHandler) {
        await this.messageHandler(topic, parsedMessage);
      }
    } catch (error) {
      logger.error(
        { error, topic, partition, offset: message.offset },
        'Error processing message'
      );
    }
  }

  isHealthy(): boolean {
    return this.connected;
  }
}
