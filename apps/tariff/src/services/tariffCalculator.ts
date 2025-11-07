/**
 * Tariff Calculator Service
 * 
 * Implements rule-based dynamic pricing based on regional load
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import type { RegionalAggregate } from '../kafka/consumer.js';
import type { TariffUpdate } from '../kafka/producer.js';

const logger = createLogger('tariff-calculator');

export interface TariffCalculatorConfig {
  basePrice: number;
  minChangeThreshold: number; // Minimum price change to trigger update (e.g., 0.1)
  criticalLoadThreshold: number; // % (e.g., 90)
  highLoadThreshold: number; // % (e.g., 75)
  normalLoadThreshold: number; // % (e.g., 50)
  lowLoadThreshold: number; // % (e.g., 25)
}

export interface LoadThresholds {
  critical: number; // >90% -> +25%
  high: number; // 75-90% -> +10%
  normal: number; // 50-75% -> base
  low: number; // 25-50% -> -10%
  veryLow: number; // <25% -> -20%
}

export class TariffCalculatorService {
  private config: TariffCalculatorConfig;
  private lastPriceByRegion: Map<string, number> = new Map();
  private regionalCapacity: Map<string, number> = new Map(); // MW capacity per region

  constructor(config: TariffCalculatorConfig) {
    this.config = config;

    // Initialize regional capacity (these would normally come from a database)
    // For now, using estimated values
    this.initializeRegionalCapacity();
  }

  /**
   * Initialize regional capacity estimates
   */
  private initializeRegionalCapacity() {
    const regions = [
      { name: 'Mumbai-North', capacity: 1000 }, // MW
      { name: 'Mumbai-South', capacity: 900 },
      { name: 'Delhi-North', capacity: 1100 },
      { name: 'Delhi-South', capacity: 1000 },
      { name: 'Bangalore-East', capacity: 950 },
      { name: 'Bangalore-West', capacity: 850 },
      { name: 'Pune-East', capacity: 700 },
      { name: 'Pune-West', capacity: 650 },
      { name: 'Hyderabad-Central', capacity: 800 },
      { name: 'Chennai-North', capacity: 750 },
    ];

    for (const region of regions) {
      this.regionalCapacity.set(region.name, region.capacity);
    }
  }

  /**
   * Calculate load percentage for a region
   */
  private calculateLoadPercentage(aggregate: RegionalAggregate): number {
    const capacity = this.regionalCapacity.get(aggregate.region) || 1000; // Default 1000 MW
    const currentLoadMw = aggregate.avgPowerKw / 1000; // Convert kW to MW

    const loadPercent = (currentLoadMw / capacity) * 100;

    logger.debug(
      {
        region: aggregate.region,
        currentLoadMw,
        capacity,
        loadPercent: loadPercent.toFixed(2),
      },
      'Load calculation'
    );

    return loadPercent;
  }

  /**
   * Get price multiplier based on load percentage
   */
  private getPriceMultiplier(loadPercent: number): { multiplier: number; reason: string } {
    if (loadPercent > this.config.criticalLoadThreshold) {
      return {
        multiplier: 1.25, // +25%
        reason: `Critical load (${loadPercent.toFixed(1)}% > ${this.config.criticalLoadThreshold}%)`,
      };
    } else if (loadPercent > this.config.highLoadThreshold) {
      return {
        multiplier: 1.1, // +10%
        reason: `High load (${loadPercent.toFixed(1)}% in ${this.config.highLoadThreshold}-${this.config.criticalLoadThreshold}%)`,
      };
    } else if (loadPercent > this.config.normalLoadThreshold) {
      return {
        multiplier: 1.0, // Base price
        reason: `Normal load (${loadPercent.toFixed(1)}% in ${this.config.normalLoadThreshold}-${this.config.highLoadThreshold}%)`,
      };
    } else if (loadPercent > this.config.lowLoadThreshold) {
      return {
        multiplier: 0.9, // -10%
        reason: `Low load (${loadPercent.toFixed(1)}% in ${this.config.lowLoadThreshold}-${this.config.normalLoadThreshold}%)`,
      };
    } else {
      return {
        multiplier: 0.8, // -20%
        reason: `Very low load (${loadPercent.toFixed(1)}% < ${this.config.lowLoadThreshold}%)`,
      };
    }
  }

  /**
   * Calculate new tariff based on regional aggregate
   */
  calculateTariff(aggregate: RegionalAggregate): TariffUpdate | null {
    try {
      // Calculate load percentage
      const loadPercent = this.calculateLoadPercentage(aggregate);

      // Get price multiplier
      const { multiplier, reason } = this.getPriceMultiplier(loadPercent);

      // Calculate new price
      const newPrice = parseFloat((this.config.basePrice * multiplier).toFixed(2));

      // Get last price for this region
      const lastPrice = this.lastPriceByRegion.get(aggregate.region) || this.config.basePrice;

      // Check if change is significant enough
      const priceDifference = Math.abs(newPrice - lastPrice);

      if (priceDifference < this.config.minChangeThreshold) {
        logger.debug(
          {
            region: aggregate.region,
            lastPrice,
            newPrice,
            difference: priceDifference,
            threshold: this.config.minChangeThreshold,
          },
          'Price change below threshold, skipping update'
        );
        return null;
      }

      // Create tariff update
      const tariffUpdate: TariffUpdate = {
        tariffId: uuidv4(),
        region: aggregate.region,
        pricePerKwh: newPrice,
        effectiveFrom: new Date().toISOString(),
        reason: `AUTO: ${reason}`,
        triggeredBy: 'AUTO',
        oldPrice: lastPrice,
      };

      // Update last price
      this.lastPriceByRegion.set(aggregate.region, newPrice);

      logger.info(
        {
          region: aggregate.region,
          loadPercent: loadPercent.toFixed(2),
          oldPrice: lastPrice.toFixed(2),
          newPrice: newPrice.toFixed(2),
          change: ((newPrice - lastPrice) / lastPrice * 100).toFixed(1) + '%',
          reason,
        },
        'Tariff updated'
      );

      return tariffUpdate;
    } catch (error) {
      logger.error({ error, aggregate }, 'Error calculating tariff');
      return null;
    }
  }

  /**
   * Set last known price for a region (used during initialization)
   */
  setLastPrice(region: string, price: number): void {
    this.lastPriceByRegion.set(region, price);
  }

  /**
   * Get current price for a region
   */
  getCurrentPrice(region: string): number {
    return this.lastPriceByRegion.get(region) || this.config.basePrice;
  }

  /**
   * Get all current prices
   */
  getAllPrices(): Map<string, number> {
    return new Map(this.lastPriceByRegion);
  }

  /**
   * Update regional capacity (for administrative purposes)
   */
  setRegionalCapacity(region: string, capacityMw: number): void {
    this.regionalCapacity.set(region, capacityMw);
    logger.info({ region, capacityMw }, 'Regional capacity updated');
  }
}
