import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('redis');

export interface MeterLastSeen {
  meter_id: string;
  last_seen: Date;
  region: string;
}

export class RedisCacheService {
  private static instance: RedisCacheService;
  private client: RedisClientType;
  private connected: boolean = false;
  private readonly TTL_SECONDS = 3600;

  private constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

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

  static getInstance(redisUrl?: string): RedisCacheService {
    if (!RedisCacheService.instance) {
      if (!redisUrl) throw new Error('Redis URL required for first initialization');
      RedisCacheService.instance = new RedisCacheService(redisUrl);
    }
    return RedisCacheService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from Redis');
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.connected;
  }

  async updateMeterLastSeen(meterId: string, region: string, timestamp: Date = new Date()): Promise<void> {
    try {
      const key = `last_seen:${meterId}`;
      const data = {
        meter_id: meterId,
        region,
        last_seen: timestamp.toISOString()
      };

      await this.client.setEx(key, this.TTL_SECONDS, JSON.stringify(data));
      logger.debug({ meterId, region }, 'Updated meter last seen');
    } catch (error) {
      logger.error({ error, meterId }, 'Failed to update meter last seen');
      throw error;
    }
  }

  async getMeterLastSeen(meterId: string): Promise<MeterLastSeen | null> {
    try {
      const key = `last_seen:${meterId}`;
      const data = await this.client.get(key);

      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        meter_id: parsed.meter_id,
        region: parsed.region,
        last_seen: new Date(parsed.last_seen)
      };
    } catch (error) {
      logger.error({ error, meterId }, 'Failed to get meter last seen');
      throw error;
    }
  }

  async getInactiveMeters(thresholdMs: number): Promise<MeterLastSeen[]> {
    try {
      const keys = await this.client.keys('last_seen:*');
      const inactiveMeters: MeterLastSeen[] = [];
      const cutoffTime = Date.now() - thresholdMs;

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const lastSeenTime = new Date(parsed.last_seen).getTime();

          if (lastSeenTime < cutoffTime) {
            inactiveMeters.push({
              meter_id: parsed.meter_id,
              region: parsed.region,
              last_seen: new Date(parsed.last_seen)
            });
          }
        }
      }

      return inactiveMeters;
    } catch (error) {
      logger.error({ error }, 'Failed to get inactive meters');
      throw error;
    }
  }

  async updateRegionLoad(region: string, loadPercentage: number, timestamp: Date = new Date()): Promise<void> {
    try {
      const key = `region:load:${region}`;
      const data = {
        load_percentage: loadPercentage,
        timestamp: timestamp.toISOString()
      };

      await this.client.setEx(key, 600, JSON.stringify(data));
      logger.debug({ region, loadPercentage }, 'Updated region load');
    } catch (error) {
      logger.error({ error, region }, 'Failed to update region load');
      throw error;
    }
  }

  async getRegionLoad(region: string): Promise<{ load_percentage: number; timestamp: Date } | null> {
    try {
      const key = `region:load:${region}`;
      const data = await this.client.get(key);

      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        load_percentage: parsed.load_percentage,
        timestamp: new Date(parsed.timestamp)
      };
    } catch (error) {
      logger.error({ error, region }, 'Failed to get region load');
      throw error;
    }
  }

  async addOverloadWindow(region: string, timestamp: Date): Promise<void> {
    try {
      const key = `region:overload:${region}`;
      const timestampStr = timestamp.toISOString();
      const existing = await this.client.get(key);
      const windows = existing ? JSON.parse(existing) : [];

      windows.push(timestampStr);
      await this.client.setEx(key, 600, JSON.stringify(windows));

      logger.debug({ region, windowCount: windows.length }, 'Added overload window');
    } catch (error) {
      logger.error({ error, region }, 'Failed to add overload window');
      throw error;
    }
  }

  async getOverloadWindowCount(region: string, withinMs: number): Promise<number> {
    try {
      const key = `region:overload:${region}`;
      const data = await this.client.get(key);

      if (!data) return 0;

      const windows: string[] = JSON.parse(data);
      const cutoffTime = Date.now() - withinMs;

      return windows.filter(ts => new Date(ts).getTime() >= cutoffTime).length;
    } catch (error) {
      logger.error({ error, region }, 'Failed to get overload window count');
      throw error;
    }
  }

  async hasActiveAlert(region: string, type: string, meterId?: string): Promise<boolean> {
    try {
      const key = meterId
        ? `alerts:active:${region}:${type}:${meterId}`
        : `alerts:active:${region}:${type}`;

      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, region, type }, 'Failed to check active alert');
      throw error;
    }
  }

  async setActiveAlert(region: string, type: string, meterId?: string): Promise<void> {
    try {
      const key = meterId
        ? `alerts:active:${region}:${type}:${meterId}`
        : `alerts:active:${region}:${type}`;

      await this.client.setEx(key, 300, '1'); // 5 minutes
      logger.debug({ region, type, meterId }, 'Set active alert marker');
    } catch (error) {
      logger.error({ error, region, type }, 'Failed to set active alert');
      throw error;
    }
  }

  async clearActiveAlert(region: string, type: string, meterId?: string): Promise<void> {
    try {
      const key = meterId
        ? `alerts:active:${region}:${type}:${meterId}`
        : `alerts:active:${region}:${type}`;

      await this.client.del(key);
      logger.debug({ region, type, meterId }, 'Cleared active alert marker');
    } catch (error) {
      logger.error({ error, region, type }, 'Failed to clear active alert');
      throw error;
    }
  }

  async setDeduplicationMarker(
    alertType: string,
    region: string,
    meterId: string | undefined,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const key = meterId
        ? `dedup:${alertType}:${region}:${meterId}`
        : `dedup:${alertType}:${region}`;

      await this.client.setEx(key, ttlSeconds, '1');
      logger.debug({ alertType, region, meterId }, 'Set deduplication marker');
    } catch (error) {
      logger.error({ error, alertType, region }, 'Failed to set deduplication marker');
      throw error;
    }
  }

  async checkDeduplicationMarker(
    alertType: string,
    region: string,
    meterId: string | undefined
  ): Promise<boolean> {
    try {
      const key = meterId
        ? `dedup:${alertType}:${region}:${meterId}`
        : `dedup:${alertType}:${region}`;

      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ error, alertType, region }, 'Failed to check deduplication marker');
      throw error;
    }
  }
}
