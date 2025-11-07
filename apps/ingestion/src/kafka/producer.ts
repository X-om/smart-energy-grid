/**
 * Kafka Producer Service
 * 
 * Publishes validated telemetry readings to the Kafka topic.
 * Handles connection management, retries, and error handling.
 */

import { Kafka, Producer, Partitioners } from 'kafkajs';
import { createLogger } from '../utils/logger.js';
import type { TelemetryReading } from '@segs/shared-types';

const logger = createLogger('kafka-producer');

export interface KafkaProducerConfig {
  brokers: string[];
  clientId: string;
  topic: string;
}

export interface PublishResult {
  success: boolean;
  offset?: string;
  partition?: number;
  error?: Error;
}

export class KafkaProducerService {
  private kafka: Kafka;
  private producer: Producer;
  private topic: string;
  private connected: boolean = false;

  constructor(config: KafkaProducerConfig) {
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

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      allowAutoTopicCreation: true,
      transactionTimeout: 60000,
      retry: {
        initialRetryTime: 300,
        retries: 5,
        multiplier: 2,
        maxRetryTime: 30000,
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Get Kafka log level from environment
   */
  private getKafkaLogLevel() {
    const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    const levels: Record<string, number> = {
      debug: 5,
      info: 4,
      warn: 2,
      error: 1,
    };
    return levels[logLevel] || 4;
  }

  /**
   * Setup Kafka producer event handlers
   */
  private setupEventHandlers() {
    this.producer.on('producer.connect', () => {
      this.connected = true;
      logger.info('Kafka producer connected');
    });

    this.producer.on('producer.disconnect', () => {
      this.connected = false;
      logger.info('Kafka producer disconnected');
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      logger.warn({ payload }, 'Kafka request timeout');
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info(
        {
          topic: this.topic,
        },
        'Kafka producer ready'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka producer');
      throw error;
    }
  }

  /**
   * Publish a single telemetry reading to Kafka
   */
  async publishReading(reading: TelemetryReading): Promise<PublishResult> {
    if (!this.connected) {
      return {
        success: false,
        error: new Error('Kafka producer not connected'),
      };
    }

    try {
      const startTime = Date.now();
      const result = await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: reading.meterId, // Partition by meterId for ordering
            value: JSON.stringify(reading),
            timestamp: new Date(reading.timestamp).getTime().toString(),
            headers: {
              readingId: reading.readingId,
              region: reading.region,
            },
          },
        ],
      });

      const latency = Date.now() - startTime;
      const metadata = result[0];

      logger.debug(
        {
          readingId: reading.readingId,
          meterId: reading.meterId,
          partition: metadata.partition,
          offset: metadata.offset,
          latency,
        },
        'Published reading to Kafka'
      );

      return {
        success: true,
        offset: metadata.offset,
        partition: metadata.partition,
      };
    } catch (error) {
      logger.error(
        {
          error,
          readingId: reading.readingId,
          meterId: reading.meterId,
        },
        'Error publishing reading to Kafka'
      );
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Publish a batch of telemetry readings to Kafka
   * Uses Promise.allSettled for resilience
   */
  async publishBatch(readings: TelemetryReading[]): Promise<{
    successful: number;
    failed: number;
    results: PublishResult[];
    partitions: Set<number>;
  }> {
    if (!this.connected) {
      return {
        successful: 0,
        failed: readings.length,
        results: readings.map(() => ({
          success: false,
          error: new Error('Kafka producer not connected'),
        })),
        partitions: new Set(),
      };
    }

    const startTime = Date.now();

    try {
      // Prepare messages
      const messages = readings.map((reading) => ({
        key: reading.meterId,
        value: JSON.stringify(reading),
        timestamp: new Date(reading.timestamp).getTime().toString(),
        headers: {
          readingId: reading.readingId,
          region: reading.region,
        },
      }));

      // Send batch to Kafka
      const result = await this.producer.send({
        topic: this.topic,
        messages,
      });

      const latency = Date.now() - startTime;
      const partitions = new Set(result.map((r) => r.partition));

      logger.info(
        {
          count: readings.length,
          partitions: Array.from(partitions),
          latency,
        },
        'Published batch to Kafka'
      );

      return {
        successful: readings.length,
        failed: 0,
        results: result.map((metadata) => ({
          success: true,
          offset: metadata.offset,
          partition: metadata.partition,
        })),
        partitions,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error(
        {
          error,
          count: readings.length,
          latency,
        },
        'Error publishing batch to Kafka'
      );

      return {
        successful: 0,
        failed: readings.length,
        results: readings.map(() => ({
          success: false,
          error: error as Error,
        })),
        partitions: new Set(),
      };
    }
  }

  /**
   * Publish batch with individual error handling
   * More resilient but slower than publishBatch
   */
  async publishBatchIndividual(readings: TelemetryReading[]): Promise<{
    successful: number;
    failed: number;
    results: PublishResult[];
    partitions: Set<number>;
  }> {
    const startTime = Date.now();
    const results = await Promise.allSettled(
      readings.map((reading) => this.publishReading(reading))
    );

    const partitions = new Set<number>();
    let successful = 0;
    let failed = 0;

    const publishResults: PublishResult[] = results.map((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successful++;
          if (result.value.partition !== undefined) {
            partitions.add(result.value.partition);
          }
        } else {
          failed++;
        }
        return result.value;
      } else {
        failed++;
        return {
          success: false,
          error: result.reason,
        };
      }
    });

    const latency = Date.now() - startTime;
    logger.info(
      {
        total: readings.length,
        successful,
        failed,
        latency,
      },
      'Published batch individually'
    );

    return {
      successful,
      failed,
      results: publishResults,
      partitions,
    };
  }

  /**
   * Get producer connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Gracefully disconnect from Kafka
   */
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

  /**
   * Get the topic name
   */
  getTopic(): string {
    return this.topic;
  }
}
