import { createClient, RedisClientType } from 'redis';
import { Reading } from '../schemas/zodSchemas';
import { createLogger } from '../utils/logger';

const logger = createLogger('redis-dedupe');

interface DedupeResult {
  unique: Array<Reading>;
  duplicates: Array<Reading>;
}

export class DeduplicationService {
  private static instance: DeduplicationService;
  private client: RedisClientType;
  private ttl: number;
  private connected: boolean = false;

  private constructor(redisUrl: string, ttl: number = 60) {
    this.ttl = ttl;
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (error) => { logger.error({ error }, 'Redis client error'); });
    this.client.on('connect', () => { logger.info('Redis client connected'); });
  }

  static getInstance(redisUrl?: string, ttl?: number): DeduplicationService {
    if (!DeduplicationService.instance && redisUrl) DeduplicationService.instance = new DeduplicationService(redisUrl, ttl);
    if (!DeduplicationService.instance) throw new Error('DeduplicationService must be initialized with redisUrl first');

    return DeduplicationService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      logger.info('Redis deduplication service connected');
    } catch (error) {
      logger.error({ error }, 'Failed to connect Redis');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis deduplication service disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting Redis');
      throw error;
    }
  }

  isConnected(): boolean { return this.connected; }
  private generateKey(meterId: string, timestamp: string): string { return `reading:${meterId}:${timestamp}`; }

  async checkAndMark(meterId: string, timestamp: string): Promise<boolean> {
    const key = this.generateKey(meterId, timestamp);
    const result = await this.client.set(key, '1', { NX: true, EX: this.ttl });

    return result !== null;
  }

  async filterDuplicates(readings: Array<Reading>): Promise<DedupeResult> {
    const unique: Array<Reading> = [];
    const duplicates: Array<Reading> = [];

    await Promise.all(
      readings.map(async (reading) => {
        const isNew = await this.checkAndMark(reading.meterId, reading.timestamp);
        if (isNew) unique.push(reading); else duplicates.push(reading);
      })
    );
    return { unique, duplicates };
  }
}
