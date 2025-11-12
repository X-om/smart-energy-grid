import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { createLogger } from '../utils/logger';

const logger = createLogger('kafka-producer');

export interface KafkaProducerConfig {
  brokers: Array<string>;
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
  private static instance: KafkaProducerService;
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  private constructor(config: KafkaProducerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId, brokers: config.brokers,
      retry: { initialRetryTime: 300, retries: 8, multiplier: 2, maxRetryTime: 30000 },
      logLevel: this.getKafkaLogLevel(),
    });

    this.producer = this.kafka.producer({ allowAutoTopicCreation: true, transactionTimeout: 30000, retry: { initialRetryTime: 300, retries: 5 }, });
    this.setupEventHandlers();
  }

  public static getInstance(config?: KafkaProducerConfig): KafkaProducerService {
    if (!KafkaProducerService.instance) {
      if (!config) throw new Error('Config required for first initialization');
      KafkaProducerService.instance = new KafkaProducerService(config);
    }
    return KafkaProducerService.instance;
  }

  private getKafkaLogLevel() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const levelMap: Record<string, number> = { error: 1, warn: 2, info: 4, debug: 5 };
    return levelMap[logLevel] || 4;
  }

  private setupEventHandlers() {
    this.producer.on('producer.connect', () => { this.connected = true; logger.info('Kafka producer connected'); });
    this.producer.on('producer.disconnect', () => { this.connected = false; logger.warn('Kafka producer disconnected'); });
  }

  public async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka producer ready');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Kafka producer');
      throw error;
    }
  }

  public async publishTariffUpdate(update: TariffUpdate, topic: string): Promise<boolean> {
    try {
      const message: ProducerRecord = {
        topic, messages: [{
          key: update.region, value: JSON.stringify(update),
          headers: { type: 'tariff_update', region: update.region, triggeredBy: update.triggeredBy },
        }],
      };
      await this.producer.send(message);
      logger.info({ region: update.region, newPrice: update.pricePerKwh, oldPrice: update.oldPrice, triggeredBy: update.triggeredBy }, 'Tariff update published to Kafka');

      return true;
    } catch (error) {
      logger.error({ error, update }, 'Failed to publish tariff update');
      return false;
    }
  }

  public async publishTariffUpdates(updates: Array<TariffUpdate>, topic: string): Promise<number> {
    if (updates.length === 0) return 0;
    try {
      const messages = updates.map((update) => ({
        key: update.region,
        value: JSON.stringify(update),
        headers: { type: 'tariff_update', region: update.region, triggeredBy: update.triggeredBy },
      }));

      const message: ProducerRecord = { topic, messages };
      await this.producer.send(message);
      logger.info({ count: updates.length }, 'Batch tariff updates published to Kafka');
      return updates.length;
    } catch (error) {
      logger.error({ error, count: updates.length }, 'Failed to publish batch tariff updates');
      return 0;
    }
  }

  public isConnected(): boolean { return this.connected; }

  public async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.connected = false;
    logger.info('Disconnected from Kafka');
  }
}
