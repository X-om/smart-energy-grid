/**
 * Kafka Producer Service
 * 
 * Publishes tariff updates to downstream services
 */

import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('kafka-producer');

export interface KafkaProducerConfig {
  brokers: string[];
  clientId: string;
}

export interface TariffUpdate {
  tariffId: string;
  region: string;
  pricePerKwh: number;
  effectiveFrom: string;
  reason?: string;
  triggeredBy: string;
  oldPrice?: number;
}

export class KafkaProducerService {
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  constructor(config: KafkaProducerConfig) {
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
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
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
    this.producer.on('producer.connect', () => {
      this.connected = true;
      logger.info('Kafka producer connected');
    });

    this.producer.on('producer.disconnect', () => {
      this.connected = false;
      logger.warn('Kafka producer disconnected');
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer ready');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka producer');
      throw error;
    }
  }

  /**
   * Publish tariff update
   */
  async publishTariffUpdate(update: TariffUpdate, topic: string): Promise<boolean> {
    try {
      const message: ProducerRecord = {
        topic,
        messages: [
          {
            key: update.region,
            value: JSON.stringify(update),
            headers: {
              type: 'tariff_update',
              region: update.region,
              triggeredBy: update.triggeredBy,
            },
          },
        ],
      };

      await this.producer.send(message);

      logger.info(
        {
          region: update.region,
          newPrice: update.pricePerKwh,
          oldPrice: update.oldPrice,
          triggeredBy: update.triggeredBy,
        },
        'Tariff update published to Kafka'
      );

      return true;
    } catch (error) {
      logger.error({ error, update }, 'Failed to publish tariff update');
      return false;
    }
  }

  /**
   * Publish multiple tariff updates (batch)
   */
  async publishTariffUpdates(updates: TariffUpdate[], topic: string): Promise<number> {
    if (updates.length === 0) return 0;

    try {
      const messages = updates.map((update) => ({
        key: update.region,
        value: JSON.stringify(update),
        headers: {
          type: 'tariff_update',
          region: update.region,
          triggeredBy: update.triggeredBy,
        },
      }));

      const message: ProducerRecord = {
        topic,
        messages,
      };

      await this.producer.send(message);

      logger.info({ count: updates.length }, 'Batch tariff updates published to Kafka');

      return updates.length;
    } catch (error) {
      logger.error({ error, count: updates.length }, 'Failed to publish batch tariff updates');
      return 0;
    }
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
    await this.producer.disconnect();
    this.connected = false;
    logger.info('Disconnected from Kafka');
  }
}
