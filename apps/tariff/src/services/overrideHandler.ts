/**
 * Override Handler Service
 * 
 * Handles manual tariff override requests from operators
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import type { TariffUpdate } from '../kafka/producer.js';
import type { PostgresService } from '../db/postgres.js';
import type { RedisCacheService } from '../cache/redisClient.js';
import type { KafkaProducerService } from '../kafka/producer.js';

const logger = createLogger('override-handler');

export interface OverrideRequest {
  region: string;
  newPrice: number;
  reason?: string;
  operatorId?: string;
}

export interface OverrideResponse {
  success: boolean;
  message: string;
  tariffId?: string;
  region?: string;
  newPrice?: number;
  oldPrice?: number;
}

export class OverrideHandlerService {
  constructor(
    private db: PostgresService,
    private cache: RedisCacheService,
    private producer: KafkaProducerService,
    private outputTopic: string
  ) { }

  /**
   * Validate override request
   */
  private validateRequest(request: OverrideRequest): { valid: boolean; error?: string } {
    // Validate region
    if (!request.region || request.region.trim().length === 0) {
      return { valid: false, error: 'Region is required' };
    }

    // Validate price
    if (typeof request.newPrice !== 'number' || request.newPrice <= 0) {
      return { valid: false, error: 'Price must be a positive number' };
    }

    // Validate price range (₹0.50 - ₹20.00 per kWh)
    if (request.newPrice < 0.5 || request.newPrice > 20.0) {
      return { valid: false, error: 'Price must be between ₹0.50 and ₹20.00 per kWh' };
    }

    return { valid: true };
  }

  /**
   * Handle manual tariff override
   */
  async handleOverride(request: OverrideRequest): Promise<OverrideResponse> {
    try {
      // Validate request
      const validation = this.validateRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'Invalid request',
        };
      }

      // Get current price from cache
      const oldPrice = await this.cache.getTariff(request.region);

      // Create tariff update
      const tariffUpdate: TariffUpdate = {
        tariffId: uuidv4(),
        region: request.region,
        pricePerKwh: request.newPrice,
        effectiveFrom: new Date().toISOString(),
        reason: request.reason || 'Manual override',
        triggeredBy: request.operatorId || 'MANUAL',
        oldPrice: oldPrice || undefined,
      };

      // Save to database
      await this.db.insertTariff({
        tariffId: tariffUpdate.tariffId,
        region: tariffUpdate.region,
        pricePerKwh: tariffUpdate.pricePerKwh,
        effectiveFrom: new Date(tariffUpdate.effectiveFrom),
        reason: tariffUpdate.reason,
        triggeredBy: tariffUpdate.triggeredBy,
      });

      // Update cache
      await this.cache.setTariff(request.region, request.newPrice);

      // Publish to Kafka
      await this.producer.publishTariffUpdate(tariffUpdate, this.outputTopic);

      logger.info(
        {
          region: request.region,
          oldPrice,
          newPrice: request.newPrice,
          operatorId: request.operatorId,
          reason: request.reason,
        },
        'Manual tariff override applied'
      );

      return {
        success: true,
        message: 'Tariff override applied successfully',
        tariffId: tariffUpdate.tariffId,
        region: request.region,
        newPrice: request.newPrice,
        oldPrice: oldPrice || undefined,
      };
    } catch (error) {
      logger.error({ error, request }, 'Failed to apply tariff override');

      return {
        success: false,
        message: 'Internal server error',
      };
    }
  }

  /**
   * Get current tariff for a region
   */
  async getCurrentTariff(region: string): Promise<number | null> {
    try {
      // Try cache first
      let price = await this.cache.getTariff(region);

      if (price === null) {
        // Fallback to database
        const tariff = await this.db.getCurrentTariff(region);
        if (tariff) {
          price = tariff.pricePerKwh;
          // Update cache
          await this.cache.setTariff(region, price);
        }
      }

      return price;
    } catch (error) {
      logger.error({ error, region }, 'Failed to get current tariff');
      return null;
    }
  }

  /**
   * Get tariff history for a region
   */
  async getTariffHistory(region: string, limit: number = 10) {
    try {
      return await this.db.getTariffHistory(region, limit);
    } catch (error) {
      logger.error({ error, region }, 'Failed to get tariff history');
      return [];
    }
  }
}
