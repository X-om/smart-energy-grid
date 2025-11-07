/**
 * Redis Cache Client
 * 
 * Manages caching of current tariff prices per region
 */

import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('redis');

export class RedisCacheService {
  private client: RedisClientType;
  private connected: boolean = false;
  private readonly TARIFF_PREFIX = 'tariff:';
  private readonly TTL_SECONDS = 86400; // 24 hours

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 100ms, 200ms, 400ms, ...
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Event handlers
    this.client.on('error', (err) => {
      logger.error({ error: err }, 'Redis client error');
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.connected = true;
      logger.info('Redis client ready');
    });

    this.client.on('end', () => {
      this.connected = false;
      logger.info('Redis client disconnected');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  /**
   * Set tariff for a region
   */
  async setTariff(region: string, pricePerKwh: number): Promise<void> {
    try {
      const key = `${this.TARIFF_PREFIX}${region}`;
      await this.client.setEx(key, this.TTL_SECONDS, pricePerKwh.toString());

      logger.debug({ region, price: pricePerKwh }, 'Tariff cached in Redis');
    } catch (error) {
      logger.error({ error, region, pricePerKwh }, 'Failed to set tariff in Redis');
      throw error;
    }
  }

  /**
   * Get tariff for a region
   */
  async getTariff(region: string): Promise<number | null> {
    try {
      const key = `${this.TARIFF_PREFIX}${region}`;
      const value = await this.client.get(key);

      if (!value) {
        return null;
      }

      return parseFloat(value);
    } catch (error) {
      logger.error({ error, region }, 'Failed to get tariff from Redis');
      throw error;
    }
  }

  /**
   * Preload tariffs from database
   */
  async preloadTariffs(tariffMap: Map<string, number>): Promise<void> {
    try {
      const pipeline = this.client.multi();

      for (const [region, price] of tariffMap.entries()) {
        const key = `${this.TARIFF_PREFIX}${region}`;
        pipeline.setEx(key, this.TTL_SECONDS, price.toString());
      }

      await pipeline.exec();

      logger.info({ count: tariffMap.size }, 'Preloaded tariffs into Redis');
    } catch (error) {
      logger.error({ error }, 'Failed to preload tariffs');
      throw error;
    }
  }

  /**
   * Get all tariffs (for debugging)
   */
  async getAllTariffs(): Promise<Map<string, number>> {
    try {
      const keys = await this.client.keys(`${this.TARIFF_PREFIX}*`);
      const tariffMap = new Map<string, number>();

      for (const key of keys) {
        const region = key.replace(this.TARIFF_PREFIX, '');
        const value = await this.client.get(key);
        if (value) {
          tariffMap.set(region, parseFloat(value));
        }
      }

      return tariffMap;
    } catch (error) {
      logger.error({ error }, 'Failed to get all tariffs from Redis');
      throw error;
    }
  }

  /**
   * Delete tariff for a region
   */
  async deleteTariff(region: string): Promise<void> {
    try {
      const key = `${this.TARIFF_PREFIX}${region}`;
      await this.client.del(key);

      logger.debug({ region }, 'Tariff deleted from Redis');
    } catch (error) {
      logger.error({ error, region }, 'Failed to delete tariff from Redis');
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
    this.connected = false;
    logger.info('Disconnected from Redis');
  }
}
