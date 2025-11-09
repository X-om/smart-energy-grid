import { Kafka, Consumer, EachMessagePayload, ConsumerCrashEvent } from 'kafkajs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('kafka-consumer');

export interface KafkaConsumerConfig {
  brokers: Array<string>;
  clientId: string;
  groupId: string;
  topic: string;
}

export interface RegionalAggregate {
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

export type AggregateHandler = (aggregate: RegionalAggregate) => Promise<void>;

export class KafkaConsumerService {
  private static instance: KafkaConsumerService;
  private kafka: Kafka;
  private consumer: Consumer;
  private config: KafkaConsumerConfig;
  private topic: string;
  private connected: boolean = false;
  private aggregateHandler?: AggregateHandler;

  private constructor(config: KafkaConsumerConfig) {
    this.config = config;
    this.topic = config.topic;

    this.kafka = new Kafka({
      clientId: config.clientId, brokers: config.brokers,
      retry: { initialRetryTime: 300, retries: 8, multiplier: 2, maxRetryTime: 30000 },
      logLevel: this.getKafkaLogLevel(),
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId, sessionTimeout: 30000, heartbeatInterval: 3000,
      retry: { initialRetryTime: 300, retries: 5 },
    });

    this.setupEventHandlers();
  }

  public static getInstance(config?: KafkaConsumerConfig): KafkaConsumerService {
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
    this.consumer.on('consumer.connect', () => logger.info('Kafka consumer connected'));

    this.consumer.on('consumer.disconnect', () => {
      this.connected = false;
      logger.warn('Kafka consumer disconnected');
    });

    this.consumer.on('consumer.crash', (event: ConsumerCrashEvent) => {
      const error = event.payload?.error || new Error('Consumer crashed');
      this.connected = false;
      logger.error({ error }, 'Kafka consumer crashed');
    });

    this.consumer.on('consumer.group_join', ({ payload }) => logger.info({ groupId: payload.groupId, memberId: payload.memberId }, 'Joined consumer group'));
  }

  public async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });

      this.connected = true;
      logger.info({ topic: this.topic, groupId: this.config.groupId }, 'Kafka consumer subscribed');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka consumer');
      throw error;
    }
  }

  public onAggregate(handler: AggregateHandler) { this.aggregateHandler = handler; }

  public async startConsuming(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => await this.handleMessage(payload)
      });
      logger.info('Started consuming messages');
    } catch (error) {
      logger.error({ error }, 'Failed to start consuming');
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    try {
      if (!message.value)
        return logger.warn({ topic, partition, offset: message.offset }, 'Empty message value');

      const messageStr = message.value.toString();
      const aggregate = JSON.parse(messageStr) as RegionalAggregate;

      if (!aggregate.region || !aggregate.total_consumption)
        return logger.warn({ aggregate, offset: message.offset }, 'Invalid aggregate message - missing required fields');

      if (this.aggregateHandler) await this.aggregateHandler(aggregate);
    } catch (error) {
      logger.error({ error, topic, partition, offset: message.offset }, 'Error handling message');
    }
  }

  public async pause(): Promise<void> {
    this.consumer.pause([{ topic: this.topic }]);
    logger.info('Consumer paused');
  }

  public async resume(): Promise<void> {
    this.consumer.resume([{ topic: this.topic }]);
    logger.info('Consumer resumed');
  }

  public isConnected(): boolean { return this.connected; }

  public async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    this.connected = false;
    logger.info('Disconnected from Kafka');
  }
}
