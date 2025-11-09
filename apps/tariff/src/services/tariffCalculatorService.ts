import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import type { RegionalAggregate } from './kafkaConsumerService.js';
import type { TariffUpdate } from './kafkaProducerService.js';

const logger = createLogger('tariff-calculator');

export interface TariffCalculatorConfig {
  basePrice: number;
  minChangeThreshold: number;
  criticalLoadThreshold: number;
  highLoadThreshold: number;
  normalLoadThreshold: number;
  lowLoadThreshold: number;
}

export class TariffCalculatorService {
  private static instance: TariffCalculatorService;
  private config: TariffCalculatorConfig;
  private lastPriceByRegion: Map<string, number> = new Map();
  private regionalCapacity: Map<string, number> = new Map();

  private constructor(config: TariffCalculatorConfig) {
    this.config = config;
    this.initializeRegionalCapacity();
  }

  static getInstance(config?: TariffCalculatorConfig): TariffCalculatorService {
    if (!TariffCalculatorService.instance) {
      if (!config) throw new Error('Config required for first initialization');
      TariffCalculatorService.instance = new TariffCalculatorService(config);
    }
    return TariffCalculatorService.instance;
  }

  private initializeRegionalCapacity() {
    // ! THIS IS MOCK DATA FOR DEMO PURPOSES ONLY !
    // ? In a real-world scenario, this data would be fetched from a reliable source or configuration.
    const regions = [
      { name: 'Mumbai-North', capacity: 1000 },
      { name: 'Mumbai-South', capacity: 900 },
      { name: 'Delhi-North', capacity: 1100 },
      { name: 'Delhi-South', capacity: 1000 },
      { name: 'Bangalore-East', capacity: 950 },
      { name: 'Bangalore-West', capacity: 850 },
      { name: 'Pune-East', capacity: 700 },
      { name: 'Pune-West', capacity: 650 },
      { name: 'Hyderabad-Central', capacity: 800 },
      { name: 'Chennai-North', capacity: 750 }
    ];

    for (const region of regions) this.regionalCapacity.set(region.name, region.capacity);
  }

  private calculateLoadPercentage(aggregate: RegionalAggregate): number {
    const capacity = this.regionalCapacity.get(aggregate.region) || 1000;
    const currentLoadMw = aggregate.avgPowerKw / 1000;
    const loadPercent = (currentLoadMw / capacity) * 100;
    logger.debug({ region: aggregate.region, currentLoadMw, capacity, loadPercent: loadPercent.toFixed(2) }, 'Load calculation');
    return loadPercent;
  }

  private getPriceMultiplier(loadPercent: number): { multiplier: number; reason: string } {
    if (loadPercent > this.config.criticalLoadThreshold)
      return {
        multiplier: 1.25,
        reason: `Critical load (${loadPercent.toFixed(1)}% > ${this.config.criticalLoadThreshold}%)`
      };
    else if (loadPercent > this.config.highLoadThreshold)
      return {
        multiplier: 1.1,
        reason: `High load (${loadPercent.toFixed(1)}% in ${this.config.highLoadThreshold}-${this.config.criticalLoadThreshold}%)`
      };
    else if (loadPercent > this.config.normalLoadThreshold)
      return {
        multiplier: 1.0,
        reason: `Normal load (${loadPercent.toFixed(1)}% in ${this.config.normalLoadThreshold}-${this.config.highLoadThreshold}%)`
      };
    else if (loadPercent > this.config.lowLoadThreshold)
      return {
        multiplier: 0.9,
        reason: `Low load (${loadPercent.toFixed(1)}% in ${this.config.lowLoadThreshold}-${this.config.normalLoadThreshold}%)`
      };
    else
      return {
        multiplier: 0.8,
        reason: `Very low load (${loadPercent.toFixed(1)}% < ${this.config.lowLoadThreshold}%)`
      };
  }

  calculateTariff(aggregate: RegionalAggregate): TariffUpdate | null {
    try {
      const loadPercent = this.calculateLoadPercentage(aggregate);
      const { multiplier, reason } = this.getPriceMultiplier(loadPercent);

      const newPrice = parseFloat((this.config.basePrice * multiplier).toFixed(2));
      const lastPrice = this.lastPriceByRegion.get(aggregate.region) || this.config.basePrice;
      const priceDifference = Math.abs(newPrice - lastPrice);

      if (priceDifference < this.config.minChangeThreshold) {
        logger.debug({ region: aggregate.region, lastPrice, newPrice, difference: priceDifference, threshold: this.config.minChangeThreshold }, 'Price change below threshold, skipping update');
        return null;
      }

      const tariffUpdate: TariffUpdate = {
        tariffId: uuidv4(),
        region: aggregate.region,
        pricePerKwh: newPrice,
        effectiveFrom: new Date().toISOString(),
        reason: `AUTO: ${reason}`,
        triggeredBy: 'AUTO',
        oldPrice: lastPrice,
      };

      this.lastPriceByRegion.set(aggregate.region, newPrice);
      logger.info({
        region: aggregate.region, loadPercent: loadPercent.toFixed(2), oldPrice: lastPrice.toFixed(2),
        newPrice: newPrice.toFixed(2), change: ((newPrice - lastPrice) / lastPrice * 100).toFixed(1) + '%', reason
      }, 'Tariff updated');

      return tariffUpdate;
    } catch (error) {
      logger.error({ error, aggregate }, 'Error calculating tariff');
      return null;
    }
  }

  setLastPrice(region: string, price: number): void {
    this.lastPriceByRegion.set(region, price);
  }

  getCurrentPrice(region: string): number {
    return this.lastPriceByRegion.get(region) || this.config.basePrice;
  }

  getAllPrices(): Map<string, number> {
    return new Map(this.lastPriceByRegion);
  }

  setRegionalCapacity(region: string, capacityMw: number): void {
    this.regionalCapacity.set(region, capacityMw);
    logger.info({ region, capacityMw }, 'Regional capacity updated');
  }
}
