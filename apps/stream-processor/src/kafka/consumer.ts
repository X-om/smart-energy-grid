import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import type { TelemetryReading } from '@segs/shared-types';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('kafka-consumer');

export interface KafkaConsumerConfig {
  brokers: Array<string>;
  clientId: string;
  groupId: string;
  topic: string;
}
export type MessageHandler = (reading: TelemetryReading) => Promise<void>;

export class KafkaConsumerService {
  private static instance: KafkaConsumerService;
  private kafka: Kafka;
  private consumer: Consumer;
  private config: KafkaConsumerConfig;
  private topic: string;
  private connected: boolean = false;
  private messageHandler?: MessageHandler;

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
      retry: { initialRetryTime: 300, retries: 5, multiplier: 2, maxRetryTime: 30000 },
    });
    this.setupEventHandlers();
  }

  static getInstance(config?: KafkaConsumerConfig): KafkaConsumerService {
    if (!KafkaConsumerService.instance && config) KafkaConsumerService.instance = new KafkaConsumerService(config);
    if (!KafkaConsumerService.instance) throw new Error('KafkaConsumerService must be initialized with config first');
    return KafkaConsumerService.instance;
  }

  private getKafkaLogLevel() {
    const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    const levels: Record<string, number> = { debug: 5, info: 4, warn: 2, error: 1 };
    return levels[logLevel] || 4;
  }

  private setupEventHandlers() {
    this.consumer.on('consumer.connect', () => {
      this.connected = true;
      logger.info('Kafka consumer connected');
    });

    this.consumer.on('consumer.disconnect', () => {
      this.connected = false;
      logger.info('Kafka consumer disconnected');
    });

    this.consumer.on('consumer.crash', (event) => {
      logger.error({ error: event.payload.error }, 'Kafka consumer crashed');
      this.connected = false;
    });

    this.consumer.on('consumer.group_join', (event) =>
      logger.info({ groupId: event.payload.groupId, memberId: event.payload.memberId }, 'Joined consumer group'));

    this.consumer.on('consumer.heartbeat', () =>
      logger.debug('Consumer heartbeat sent'));
  }

  public async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });

      logger.info({ topic: this.topic, groupId: this.config.groupId }, 'Kafka consumer subscribed');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka consumer');
      throw error;
    }
  }

  public onMessage(handler: MessageHandler) { this.messageHandler = handler; }

  public async startConsuming(): Promise<void> {
    try {
      if (!this.messageHandler) throw new Error('Message handler not registered');

      await this.consumer.run({
        autoCommit: true, autoCommitInterval: 5000,
        eachMessage: async (payload: EachMessagePayload) => await this.handleMessage(payload)
      });

      logger.info('Started consuming messages');
    } catch (error) {
      logger.error({ error }, 'Error starting consumer');
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) return void logger.warn({ topic, partition, offset: message.offset }, 'Empty message value');
      const reading = JSON.parse(String(message.value)) as TelemetryReading;

      if (!reading.readingId || !reading.meterId || !reading.timestamp || !reading.powerKw)
        return void logger.warn({ topic, partition, offset: message.offset, reading, }, 'Invalid reading structure');

      if (this.messageHandler)
        await this.messageHandler(reading);

      return void logger.debug({ topic, partition, offset: message.offset, meterId: reading.meterId, timestamp: reading.timestamp }, 'Message processed');

    } catch (error) {
      return void logger.error({ error, topic, partition, offset: message.offset, }, 'Error handling message');
    }
  }

  public async getLag(): Promise<number> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const topicOffsets = await admin.fetchTopicOffsets(this.topic);
      const consumerOffsets = await admin.fetchOffsets({ groupId: this.config.groupId, topics: [this.topic] });
      await admin.disconnect();

      let totalLag = 0;
      if (consumerOffsets.length > 0 && consumerOffsets[0].partitions) {
        for (const partition of consumerOffsets[0].partitions) {
          const topicOffset = topicOffsets.find((t) => t.partition === partition.partition);
          if (topicOffset) {
            const lag = BigInt(topicOffset.high) - BigInt(partition.offset || '0');
            totalLag += Number(lag);
          }
        }
      }

      return totalLag;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch consumer lag');
      return 0;
    }
  }

  public isConnected(): boolean { return this.connected; }

  public async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.consumer.disconnect();
        logger.info('Disconnected from Kafka');
      }
    } catch (error) { logger.error({ error }, 'Error disconnecting from Kafka'); }
  }

  public async pause(): Promise<void> {
    try {
      this.consumer.pause([{ topic: this.topic }]);
      logger.info('Consumer paused');
    } catch (error) {
      logger.error({ error }, 'Error pausing consumer');
    }
  }

  public async resume(): Promise<void> {
    try {
      this.consumer.resume([{ topic: this.topic }]);
      logger.info('Consumer resumed');
    } catch (error) {
      logger.error({ error }, 'Error resuming consumer');
    }
  }
}
