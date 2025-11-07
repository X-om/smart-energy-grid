/**
 * Redis-based Deduplication Service
 * 
 * Prevents duplicate telemetry readings from being processed
 * within a configurable TTL window (default 60 seconds).
 * 
 * Key pattern: reading:<readingId>
 * Value: timestamp of first occurrence
 */

import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../utils/logger.js';
import type { TelemetryReading } from '@segs/shared-types';

const logger = createLogger('redis-dedupe');

export class DeduplicationService {
  private client: RedisClientType;
  private ttl: number;
  private connected: boolean = false;

  constructor(redisUrl: string, ttl: number = 60) {
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.ttl = ttl;
    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers() {
    this.client.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
    });

    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.connected = true;
      logger.info('Redis client ready');
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
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
      logger.info({ ttl: this.ttl }, 'Connected to Redis for deduplication');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  /**
   * Check if a reading is a duplicate
   * @returns true if duplicate, false if new
   */
  async isDuplicate(readingId: string): Promise<boolean> {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping deduplication check');
      return false;
    }

    try {
      const key = this.buildKey(readingId);
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, readingId }, 'Error checking duplicate');
      // On error, allow the reading through (fail open)
      return false;
    }
  }

  /**
   * Mark a reading as seen (store in Redis with TTL)
   */
  async markAsSeen(readingId: string): Promise<void> {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping deduplication mark');
      return;
    }

    try {
      const key = this.buildKey(readingId);
      const timestamp = new Date().toISOString();
      await this.client.setEx(key, this.ttl, timestamp);
    } catch (error) {
      logger.error({ error, readingId }, 'Error marking reading as seen');
      // Don't throw - this is not critical
    }
  }

  /**
   * Check and mark a reading in a single atomic operation
   * @returns true if reading is new (not duplicate), false if duplicate
   */
  async checkAndMark(readingId: string): Promise<boolean> {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping deduplication');
      return true; // Allow through if Redis unavailable
    }

    try {
      const key = this.buildKey(readingId);
      const timestamp = new Date().toISOString();

      // SET NX (set if not exists) with EX (expiry)
      const result = await this.client.set(key, timestamp, {
        NX: true, // Only set if key doesn't exist
        EX: this.ttl, // Set expiry
      });

      // result is null if key already existed (duplicate)
      return result !== null;
    } catch (error) {
      logger.error({ error, readingId }, 'Error in checkAndMark');
      // On error, allow the reading through (fail open)
      return true;
    }
  }

  /**
   * Process a batch of readings and filter out duplicates
   * @returns Object with unique and duplicate readings
   */
  async filterDuplicates(readings: TelemetryReading[]): Promise<{
    unique: TelemetryReading[];
    duplicates: TelemetryReading[];
  }> {
    const unique: TelemetryReading[] = [];
    const duplicates: TelemetryReading[] = [];

    // Process in parallel for performance
    const results = await Promise.allSettled(
      readings.map(async (reading) => {
        const isNew = await this.checkAndMark(reading.readingId);
        return { reading, isNew };
      })
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.isNew) {
          unique.push(result.value.reading);
        } else {
          duplicates.push(result.value.reading);
        }
      } else {
        // On error, include the reading (fail open)
        logger.warn(
          { error: result.reason, readingId: readings[index].readingId },
          'Error processing reading, allowing through'
        );
        unique.push(readings[index]);
      }
    });

    return { unique, duplicates };
  }

  /**
   * Build the Redis key for a reading ID
   */
  private buildKey(readingId: string): string {
    return `reading:${readingId}`;
  }

  /**
   * Get Redis client stats
   */
  async getStats(): Promise<{
    connected: boolean;
    dbSize: number;
  }> {
    try {
      const dbSize = this.connected ? await this.client.dbSize() : 0;
      return {
        connected: this.connected,
        dbSize,
      };
    } catch (error) {
      logger.error({ error }, 'Error getting Redis stats');
      return {
        connected: false,
        dbSize: 0,
      };
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.client.quit();
        logger.info('Disconnected from Redis');
      }
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Redis');
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
