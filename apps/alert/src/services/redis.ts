import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

export interface MeterLastSeen {
  meter_id: string;
  last_seen: Date;
  region: string;
}

class RedisService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      }
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }

  // Meter last seen tracking
  async updateMeterLastSeen(meterId: string, region: string, timestamp: Date = new Date()): Promise<void> {
    try {
      const key = `last_seen:${meterId}`;
      const data = {
        meter_id: meterId,
        region,
        last_seen: timestamp.toISOString()
      };

      await this.client.setEx(key, 3600, JSON.stringify(data)); // TTL 1 hour
      logger.debug(`Updated last seen for meter ${meterId}`);
    } catch (error) {
      logger.error(`Failed to update last seen for meter ${meterId}:`, error);
      throw error;
    }
  }

  async getMeterLastSeen(meterId: string): Promise<MeterLastSeen | null> {
    try {
      const key = `last_seen:${meterId}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        meter_id: parsed.meter_id,
        region: parsed.region,
        last_seen: new Date(parsed.last_seen)
      };
    } catch (error) {
      logger.error(`Failed to get last seen for meter ${meterId}:`, error);
      throw error;
    }
  }

  async getInactiveMeters(inactiveThresholdMs: number = 30000): Promise<MeterLastSeen[]> {
    try {
      const pattern = 'last_seen:*';
      const keys = await this.client.keys(pattern);
      const inactiveMeters: MeterLastSeen[] = [];
      const now = new Date();

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const lastSeen = new Date(parsed.last_seen);
          const timeDiff = now.getTime() - lastSeen.getTime();

          if (timeDiff > inactiveThresholdMs) {
            inactiveMeters.push({
              meter_id: parsed.meter_id,
              region: parsed.region,
              last_seen: lastSeen
            });
          }
        }
      }

      return inactiveMeters;
    } catch (error) {
      logger.error('Failed to get inactive meters:', error);
      throw error;
    }
  }

  // Alert deduplication
  async setActiveAlert(region: string, type: string, meterId?: string): Promise<void> {
    try {
      const key = meterId
        ? `active_alerts:${region}:${type}:${meterId}`
        : `active_alerts:${region}:${type}`;

      await this.client.setEx(key, 300, 'true'); // TTL 5 minutes
      logger.debug(`Set active alert: ${key}`);
    } catch (error) {
      logger.error(`Failed to set active alert for ${region}:${type}:`, error);
      throw error;
    }
  }

  async hasActiveAlert(region: string, type: string, meterId?: string): Promise<boolean> {
    try {
      const key = meterId
        ? `active_alerts:${region}:${type}:${meterId}`
        : `active_alerts:${region}:${type}`;

      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Failed to check active alert for ${region}:${type}:`, error);
      return false;
    }
  }

  async clearActiveAlert(region: string, type: string, meterId?: string): Promise<void> {
    try {
      const key = meterId
        ? `active_alerts:${region}:${type}:${meterId}`
        : `active_alerts:${region}:${type}`;

      await this.client.del(key);
      logger.debug(`Cleared active alert: ${key}`);
    } catch (error) {
      logger.error(`Failed to clear active alert for ${region}:${type}:`, error);
      throw error;
    }
  }

  // Regional load tracking for overload detection
  async updateRegionLoad(region: string, loadPercentage: number, timestamp: Date = new Date()): Promise<void> {
    try {
      const key = `region_load:${region}`;
      const data = {
        region,
        load: loadPercentage,
        timestamp: timestamp.toISOString()
      };

      await this.client.setEx(key, 300, JSON.stringify(data)); // TTL 5 minutes
      logger.debug(`Updated region load for ${region}: ${loadPercentage}%`);
    } catch (error) {
      logger.error(`Failed to update region load for ${region}:`, error);
      throw error;
    }
  }

  async getRegionLoad(region: string): Promise<{ load: number; timestamp: Date } | null> {
    try {
      const key = `region_load:${region}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        load: parsed.load,
        timestamp: new Date(parsed.timestamp)
      };
    } catch (error) {
      logger.error(`Failed to get region load for ${region}:`, error);
      return null;
    }
  }

  // Overload window tracking
  async addOverloadWindow(region: string, timestamp: Date = new Date()): Promise<void> {
    try {
      const key = `overload_windows:${region}`;
      const member = timestamp.getTime().toString();

      // Add to sorted set with timestamp as score
      await this.client.zAdd(key, { score: timestamp.getTime(), value: member });

      // Remove old entries (older than 10 minutes)
      const tenMinutesAgo = timestamp.getTime() - (10 * 60 * 1000);
      await this.client.zRemRangeByScore(key, 0, tenMinutesAgo);

      // Set TTL
      await this.client.expire(key, 600); // 10 minutes

      logger.debug(`Added overload window for ${region}`);
    } catch (error) {
      logger.error(`Failed to add overload window for ${region}:`, error);
      throw error;
    }
  }

  async getOverloadWindowCount(region: string, timeWindowMs: number = 300000): Promise<number> {
    try {
      const key = `overload_windows:${region}`;
      const now = Date.now();
      const windowStart = now - timeWindowMs;

      const count = await this.client.zCount(key, windowStart, now);
      return count;
    } catch (error) {
      logger.error(`Failed to get overload window count for ${region}:`, error);
      return 0;
    }
  }

  async clearOverloadWindows(region: string): Promise<void> {
    try {
      const key = `overload_windows:${region}`;
      await this.client.del(key);
      logger.debug(`Cleared overload windows for ${region}`);
    } catch (error) {
      logger.error(`Failed to clear overload windows for ${region}:`, error);
      throw error;
    }
  }

  // Cache management
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Failed to set cache key ${key}:`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check existence of cache key ${key}:`, error);
      return false;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.client.flushAll();
      logger.info('Redis cache flushed');
    } catch (error) {
      logger.error('Failed to flush Redis cache:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export const redisService = new RedisService();