import { Kafka, Producer, RecordMetadata } from 'kafkajs';
import { Reading } from '../schemas/zodSchemas';
import { createLogger } from '../utils/logger';

const logger = createLogger('kafka-producer');

interface KafkaProducerConfig {
  brokers: Array<string>;
  clientId: string;
  topic: string;
}

interface PublishResult {
  success: boolean;
  partition?: number;
  offset?: string;
  error?: Error;
}

interface BatchPublishResult {
  successful: number;
  failed: number;
  partitions: Set<number>;
}

export class KafkaProducerService {
  private static instance: KafkaProducerService;
  private kafka: Kafka;
  private producer: Producer;
  private topic: string;
  private connected: boolean = false;

  private constructor(config: KafkaProducerConfig) {
    this.topic = config.topic;
    this.kafka = new Kafka({
      clientId: config.clientId, brokers: config.brokers,
      retry: { initialRetryTime: 100, retries: 8 }
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: false, transactionTimeout: 30000 });
  }

  static getInstance(config?: KafkaProducerConfig): KafkaProducerService {
    if (!KafkaProducerService.instance && config) KafkaProducerService.instance = new KafkaProducerService(config);
    if (!KafkaProducerService.instance) throw new Error('KafkaProducerService must be initialized with config first');

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

  isConnected(): boolean { return this.connected; }

  getTopic(): string { return this.topic; }

  async publishReading(reading: Reading): Promise<PublishResult> {
    try {
      const message = { key: reading.meterId, value: JSON.stringify({ ...reading, receivedAt: new Date().toISOString() }) };
      const result: Array<RecordMetadata> = await this.producer.send({ topic: this.topic, messages: [message] });

      return { success: true, partition: result[0].partition, offset: result[0].offset };
    } catch (error) {
      logger.error({ error, meterId: reading.meterId }, 'Failed to publish reading');
      return { success: false, error: error as Error };
    }
  }

  async publishBatch(readings: Array<Reading>): Promise<BatchPublishResult> {
    try {
      const messages = readings.map((reading) => ({
        key: reading.meterId, value: JSON.stringify({ ...reading, receivedAt: new Date().toISOString() })
      }));

      const result: Array<RecordMetadata> = await this.producer.send({ topic: this.topic, messages });
      const partitions = new Set(result.map((r) => r.partition));

      return { successful: readings.length, failed: 0, partitions };
    } catch (error) {
      logger.error({ error, count: readings.length }, 'Failed to publish batch');
      return { successful: 0, failed: readings.length, partitions: new Set() };
    }
  }
}
