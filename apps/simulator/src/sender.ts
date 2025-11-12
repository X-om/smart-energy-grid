import axios, { AxiosError } from 'axios';
import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import pLimit from 'p-limit';
import { TelemetryReading } from '@segs/shared-types';
import { SimulatorConfig, BatchResponse } from './types';
import { logger } from './utils/logger';
import { chunkArray } from './generator';

// * Abstract sender interface.
export interface Sender {
  send(readings: TelemetryReading[]): Promise<BatchResponse[]>;
  close(): Promise<void>;
}

// * HTTP-based sender using axios.
export class HttpSender implements Sender {
  private config: SimulatorConfig;
  private limit: ReturnType<typeof pLimit>;

  constructor(config: SimulatorConfig) {
    this.config = config;
    this.limit = pLimit(config.concurrencyLimit);
  }

  // * Send readings via HTTP POST in batches.
  async send(readings: Array<TelemetryReading>): Promise<Array<BatchResponse>> {
    const batches = chunkArray(readings, this.config.batchSize);
    const responses: Array<BatchResponse> = [];

    logger.debug({ totalReadings: readings.length, batchCount: batches.length, batchSize: this.config.batchSize }, 'Sending readings via HTTP');

    const promises = batches.map(batch => this.limit(() => this.sendBatch(batch)));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') responses.push(result.value);
      else {
        logger.error({ error: result.reason }, 'Batch send failed');
        responses.push({ success: false, accepted: 0, error: result.reason?.message || 'Unknown error', latencyMs: 0, });
      }
    } return responses;
  }

  // * Send a single batch with retry logic.
  private async sendBatch(readings: Array<TelemetryReading>): Promise<BatchResponse> {
    const startTime = Date.now();

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {

        await axios.post(this.config.ingestionUrl, readings, { headers: { 'Content-Type': 'application/json', }, timeout: 30000, });
        const latencyMs = Date.now() - startTime;

        return { success: true, accepted: readings.length, rejected: 0, latencyMs, };

      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retryAttempts - 1) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          logger.warn({ attempt: attempt + 1, maxAttempts: this.config.retryAttempts, delay, error: (error as AxiosError).message, }, 'Retrying batch send');
          await sleep(delay);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const errorMessage = lastError?.message || 'Unknown error';

    logger.error({ batchSize: readings.length, attempts: this.config.retryAttempts, error: errorMessage, }, 'Failed to send batch after all retries');
    return { success: false, accepted: 0, error: errorMessage, latencyMs, };
  }

  async close(): Promise<void> { logger.info('HTTP sender closed'); }
}

// * Kafka-based sender using kafkajs.
export class KafkaSender implements Sender {
  private config: SimulatorConfig;
  private kafka: Kafka;
  private producer: Producer | null = null;
  private connected = false;
  private limit: ReturnType<typeof pLimit>;

  constructor(config: SimulatorConfig) {
    this.config = config;
    this.limit = pLimit(config.concurrencyLimit);

    this.kafka = new Kafka({
      clientId: config.kafkaClientId, brokers: config.kafkaBrokers,
      retry: { initialRetryTime: config.retryDelayMs, retries: config.retryAttempts }
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true, transactionTimeout: 30000 });
  }

  // * Connect to Kafka.
  private async connect(): Promise<void> {
    try {
      if (this.connected || !this.producer) return;
      logger.info({ brokers: this.config.kafkaBrokers }, 'Connecting to Kafka');
      await this.producer.connect();

      this.connected = true;
      logger.info('Connected to Kafka');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Kafka');
      throw error;
    }
  }

  // * Send readings to Kafka topic in batches.
  async send(readings: Array<TelemetryReading>): Promise<BatchResponse[]> {
    if (!this.connected) await this.connect();

    const batches = chunkArray(readings, this.config.batchSize);
    const responses: Array<BatchResponse> = [];

    logger.debug({ totalReadings: readings.length, batchCount: batches.length, topic: this.config.kafkaTopic, }, 'Sending readings to Kafka');

    const promises = batches.map(batch => this.limit(() => this.sendBatch(batch)));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') responses.push(result.value);
      else {
        logger.error({ error: result.reason }, 'Kafka batch send failed');
        responses.push({ success: false, accepted: 0, error: result.reason?.message || 'Unknown error', latencyMs: 0, });
      }
    }
    return responses;
  }

  // * Send a single batch to Kafka.
  private async sendBatch(readings: Array<TelemetryReading>): Promise<BatchResponse> {
    if (!this.producer) throw new Error('Kafka producer not initialized');
    const startTime = Date.now();

    try {
      const messages = readings.map(reading => ({ key: reading.meterId, value: JSON.stringify(reading), timestamp: String(new Date(reading.timestamp).getTime()) }));
      const record: ProducerRecord = { topic: this.config.kafkaTopic, messages };

      await this.producer.send(record);
      const latencyMs = Date.now() - startTime;

      return { success: true, accepted: readings.length, rejected: 0, latencyMs, };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      logger.error({ batchSize: readings.length, error: errorMessage, }, 'Failed to send batch to Kafka');
      return { success: false, accepted: 0, error: errorMessage, latencyMs, };
    }
  }

  // * Disconnect from Kafka.
  async close(): Promise<void> {
    if (this.producer && this.connected) {
      logger.info('Disconnecting from Kafka');
      await this.producer.disconnect();

      this.connected = false;
      logger.info('Disconnected from Kafka');
    }
  }
}

// * Create appropriate sender based on configuration.
export const createSender = (config: SimulatorConfig): Sender => {
  switch (config.target) {
    case 'http': return new HttpSender(config);
    case 'kafka': return new KafkaSender(config);
    default: throw new Error(`Unknown target mode: ${config.target}`);
  }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
