/**
 * Kafka Consumer Service
 * 
 * Consumes aggregated load data from the aggregates_1m topic
 */

import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('kafka-consumer');

export interface KafkaConsumerConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  topic: string;
}

export interface RegionalAggregate {
  region: string;
  windowStart: string;
  avgPowerKw: number;
  energyKwhSum: number;
  maxPowerKw?: number;
  count?: number;
}

export type AggregateHandler = (aggregate: RegionalAggregate) => Promise<void>;

export class KafkaConsumerService {
  private kafka: Kafka;
  private consumer: Consumer;
  private config: KafkaConsumerConfig;
  private topic: string;
  private connected: boolean = false;
  private aggregateHandler?: AggregateHandler;

  constructor(config: KafkaConsumerConfig) {
    this.config = config;
    this.topic = config.topic;

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        multiplier: 2,
        maxRetryTime: 30000,
      },
      logLevel: this.getKafkaLogLevel(),
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Get Kafka log level from environment
   */
  private getKafkaLogLevel() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const levelMap: Record<string, number> = {
      error: 1,
      warn: 2,
      info: 4,
      debug: 5,
    };
    return levelMap[logLevel] || 4;
  }

  /**
   * Setup Kafka event handlers
   */
  private setupEventHandlers() {
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected');
    });

    this.consumer.on('consumer.disconnect', () => {
      this.connected = false;
      logger.warn('Kafka consumer disconnected');
    });

    this.consumer.on('consumer.crash', (event: any) => {
      const error = event.payload?.error || event.error || new Error('Consumer crashed');
      this.connected = false;
      logger.error({ error }, 'Kafka consumer crashed');
    });

    this.consumer.on('consumer.group_join', ({ payload }) => {
      logger.info(
        {
          groupId: payload.groupId,
          memberId: payload.memberId,
        },
        'Joined consumer group'
      );
    });
  }

  /**
   * Connect to Kafka and subscribe
   */
  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: this.topic,
        fromBeginning: false, // Start from latest offset
      });

      this.connected = true;
      logger.info(
        {
          topic: this.topic,
          groupId: this.config.groupId,
        },
        'Kafka consumer subscribed'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka consumer');
      throw error;
    }
  }

  /**
   * Register aggregate handler
   */
  onAggregate(handler: AggregateHandler) {
    this.aggregateHandler = handler;
  }

  /**
   * Start consuming messages
   */
  async startConsuming(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      logger.info('Started consuming messages');
    } catch (error) {
      logger.error({ error }, 'Failed to start consuming');
      throw error;
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn({ topic, partition, offset: message.offset }, 'Empty message value');
        return;
      }

      // Parse message
      const messageStr = message.value.toString();
      const aggregate = JSON.parse(messageStr) as RegionalAggregate;

      // Validate required fields
      if (!aggregate.region || !aggregate.avgPowerKw) {
        logger.warn(
          {
            aggregate,
            offset: message.offset,
          },
          'Invalid aggregate message - missing required fields'
        );
        return;
      }

      // Call handler
      if (this.aggregateHandler) {
        await this.aggregateHandler(aggregate);
      }
    } catch (error) {
      logger.error(
        {
          error,
          topic,
          partition,
          offset: message.offset,
        },
        'Error handling message'
      );
      // Don't throw - continue processing other messages
    }
  }

  /**
   * Pause consumption
   */
  async pause(): Promise<void> {
    this.consumer.pause([{ topic: this.topic }]);
    logger.info('Consumer paused');
  }

  /**
   * Resume consumption
   */
  async resume(): Promise<void> {
    this.consumer.resume([{ topic: this.topic }]);
    logger.info('Consumer resumed');
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    this.connected = false;
    logger.info('Disconnected from Kafka');
  }
}
