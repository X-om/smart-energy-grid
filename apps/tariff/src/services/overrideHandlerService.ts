import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import type { TariffUpdate } from './kafkaProducerService';
import type { PostgresService } from './postgresService';
import type { RedisCacheService } from './redisCacheService';
import type { KafkaProducerService } from './kafkaProducerService';

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
  private static instance: OverrideHandlerService;

  private constructor(
    private db: PostgresService,
    private cache: RedisCacheService,
    private producer: KafkaProducerService,
    private outputTopic: string
  ) { }

  static getInstance(db?: PostgresService, cache?: RedisCacheService, producer?: KafkaProducerService, outputTopic?: string): OverrideHandlerService {
    if (!OverrideHandlerService.instance) {
      if (!db || !cache || !producer || !outputTopic) throw new Error('All dependencies required for first initialization');
      OverrideHandlerService.instance = new OverrideHandlerService(db, cache, producer, outputTopic);
    }
    return OverrideHandlerService.instance;
  }

  private validateRequest(request: OverrideRequest): { valid: boolean; error?: string } {
    if (!request.region || request.region.trim().length === 0) return { valid: false, error: 'Region is required' };
    if (typeof request.newPrice !== 'number' || request.newPrice <= 0) return { valid: false, error: 'Price must be a positive number' };
    if (request.newPrice < 0.5 || request.newPrice > 20.0) return { valid: false, error: 'Price must be between ₹0.50 and ₹20.00 per kWh' };
    return { valid: true };
  }

  async handleOverride(request: OverrideRequest): Promise<OverrideResponse> {
    try {
      const validation = this.validateRequest(request);
      if (!validation.valid) return { success: false, message: validation.error || 'Invalid request' };

      const oldPrice = await this.cache.getTariff(request.region);

      const tariffUpdate: TariffUpdate = {
        tariffId: uuidv4(),
        region: request.region,
        pricePerKwh: request.newPrice,
        effectiveFrom: new Date().toISOString(),
        reason: request.reason || 'Manual override',
        triggeredBy: request.operatorId || 'MANUAL',
        oldPrice: oldPrice || undefined,
      };

      await this.db.insertTariff({
        tariffId: tariffUpdate.tariffId,
        region: tariffUpdate.region,
        pricePerKwh: tariffUpdate.pricePerKwh,
        effectiveFrom: new Date(tariffUpdate.effectiveFrom),
        reason: tariffUpdate.reason,
        triggeredBy: tariffUpdate.triggeredBy,
      });

      await this.cache.setTariff(request.region, request.newPrice);
      await this.producer.publishTariffUpdate(tariffUpdate, this.outputTopic);

      logger.info({ region: request.region, oldPrice, newPrice: request.newPrice, operatorId: request.operatorId, reason: request.reason }, 'Manual tariff override applied');

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
      return { success: false, message: 'Internal server error' };
    }
  }

  async getCurrentTariff(region: string): Promise<number | null> {
    try {
      let price = await this.cache.getTariff(region);
      if (price === null) {
        const tariff = await this.db.getCurrentTariff(region);
        if (tariff) {
          price = tariff.pricePerKwh;
          await this.cache.setTariff(region, price);
        }
      }
      return price;
    } catch (error) {
      logger.error({ error, region }, 'Failed to get current tariff');
      return null;
    }
  }

  async getTariffHistory(region: string, limit: number = 10) {
    try {
      return await this.db.getTariffHistory(region, limit);
    } catch (error) {
      logger.error({ error, region }, 'Failed to get tariff history');
      return [];
    }
  }

  async removeOverride(tariffId: string): Promise<OverrideResponse> {
    try {
      // Get the tariff to find its region
      const tariff = await this.db.getTariffById(tariffId);
      if (!tariff) {
        return { success: false, message: 'Tariff override not found' };
      }

      // Delete the override from database
      const deleted = await this.db.deleteTariff(tariffId);
      if (!deleted) {
        return { success: false, message: 'Failed to delete tariff override' };
      }

      // Get the most recent tariff for this region (after deleting the override)
      const latestTariff = await this.db.getCurrentTariff(tariff.region);

      if (latestTariff) {
        // Update cache with the new current price
        await this.cache.setTariff(tariff.region, latestTariff.pricePerKwh);

        // Publish update to Kafka
        const tariffUpdate: TariffUpdate = {
          tariffId: latestTariff.tariffId,
          region: tariff.region,
          pricePerKwh: latestTariff.pricePerKwh,
          effectiveFrom: latestTariff.effectiveFrom.toISOString(),
          reason: 'Override removed - reverted to previous tariff',
          triggeredBy: 'SYSTEM',
          oldPrice: tariff.pricePerKwh,
        };
        await this.producer.publishTariffUpdate(tariffUpdate, this.outputTopic);
      }

      logger.info({ tariffId, region: tariff.region }, 'Tariff override removed');

      return {
        success: true,
        message: 'Tariff override removed successfully',
        tariffId,
        region: tariff.region,
        oldPrice: tariff.pricePerKwh,
        newPrice: latestTariff?.pricePerKwh,
      };
    } catch (error) {
      logger.error({ error, tariffId }, 'Failed to remove tariff override');
      return { success: false, message: 'Internal server error' };
    }
  }
}
