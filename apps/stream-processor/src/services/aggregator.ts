import type { TelemetryReading } from '@segs/shared-types';
import { get1MinuteBucket, get15MinuteBucket } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';
import type { Aggregate1m, Aggregate15m, RegionalAggregate1m } from '../db/timescale.js';
import { config } from '../config/env.js';

const logger = createLogger('aggregator');

interface AggregateWindow {
  meterId: string;
  region: string;
  powerSum: number;
  maxPower: number;
  energySum: number;
  count: number;
}

interface StatValues {
  totalMeters1m: number
  totalReadings1m: number
  totalMeters15m: number
  totalReadings15m: number;
}

interface StatSummary {
  windows1m: {
    buckets: number;
    meters: number;
    readings: number;
  };
  windows15m: {
    buckets: number;
    meters: number;
    readings: number;
  };
}

interface RegionalDataValue {
  region: string;
  meterIds: Set<string>;
  totalPowerSum: number;
  meterCount: number;
  maxPower: number;
  minPower: number;
}

type WindowsMap = Map<string, Map<string, AggregateWindow>>;
// * Aggregator Service
// * Maintains in-memory windows and computes statistics
export class AggregatorService {
  private static instance: AggregatorService;
  private windows1m: WindowsMap = new Map();
  private windows15m: WindowsMap = new Map();
  private oldestBucket1m: string | null = null;
  private oldestBucket15m: string | null = null;
  private constructor() { }

  static getInstance(): AggregatorService {
    if (!AggregatorService.instance) AggregatorService.instance = new AggregatorService();
    return AggregatorService.instance;
  }

  // * Process a single telemetry reading
  processReading(reading: TelemetryReading): void {
    try {
      // Update 1-minute window
      const bucket1m = get1MinuteBucket(reading.timestamp);
      this.updateWindow(this.windows1m, bucket1m, reading);

      // Update 15-minute window
      const bucket15m = get15MinuteBucket(reading.timestamp);
      this.updateWindow(this.windows15m, bucket15m, reading);

      // Track oldest buckets
      if (!this.oldestBucket1m || bucket1m < this.oldestBucket1m) this.oldestBucket1m = bucket1m;
      if (!this.oldestBucket15m || bucket15m < this.oldestBucket15m) this.oldestBucket15m = bucket15m;

      logger.debug({ meterId: reading.meterId, bucket1m, bucket15m, powerKw: reading.powerKw, }, 'Reading processed');
    } catch (error) {
      logger.error({ error, reading }, 'Error processing reading');
    }
  }

  // * Update a specific window with reading data
  private updateWindow(windowsMap: WindowsMap, bucket: string, reading: TelemetryReading): void {
    if (!windowsMap.has(bucket)) windowsMap.set(bucket, new Map());

    const bucketMap = windowsMap.get(bucket)!;

    if (!bucketMap.has(reading.meterId))
      bucketMap.set(reading.meterId, {
        meterId: reading.meterId, region: reading.region, powerSum: 0, maxPower: 0, energySum: 0, count: 0
      });

    const aggregate = bucketMap.get(reading.meterId)!;

    aggregate.powerSum += reading.powerKw;
    aggregate.maxPower = Math.max(aggregate.maxPower, reading.powerKw);
    aggregate.energySum += reading.energyKwh || 0;
    aggregate.count += 1;
    aggregate.region = reading.region;
  }

  // * Get all 1-minute aggregates that are ready to flush
  // * Returns aggregates older than the current minute
  getReadyAggregates1m(): Array<Aggregate1m> {
    const currentBucket = get1MinuteBucket(new Date());
    const aggregates: Array<Aggregate1m> = [];

    for (const [bucket, meterMap] of this.windows1m.entries()) {

      // ? Only flush buckets older than current minute
      if (bucket < currentBucket) {
        for (const [meterId, window] of meterMap.entries()) {
          aggregates.push({
            meterId, region: window.region, windowStart: new Date(bucket), avgPowerKw: window.powerSum / window.count,
            maxPowerKw: window.maxPower, energyKwhSum: window.energySum, count: window.count,
          });
        }
      }
    }
    return aggregates;
  }

  // * Get regional aggregates ready to flush (one per region)
  getRegionalAggregates1m(): Array<RegionalAggregate1m> {
    const currentBucket = get1MinuteBucket(new Date());
    const regionalData = new Map<string, RegionalDataValue>();

    for (const [bucket, meterMap] of this.windows1m.entries()) {
      if (bucket < currentBucket) {
        for (const [meterId, window] of meterMap.entries()) {
          if (!regionalData.has(window.region))
            regionalData.set(window.region, { region: window.region, meterIds: new Set(), totalPowerSum: 0, meterCount: 0, maxPower: 0, minPower: Infinity });

          const regional = regionalData.get(window.region)!;
          const avgPower = window.powerSum / window.count;
          regional.meterIds.add(meterId);
          regional.totalPowerSum += avgPower;
          regional.meterCount++;
          regional.maxPower = Math.max(regional.maxPower, window.maxPower);
          regional.minPower = Math.min(regional.minPower, avgPower);
        }
      }
    }

    return Array.from(regionalData.values()).map((data) => {
      const capacity = config.regionalCapacity[data.region] || 1000000;
      const loadPercentage = (data.totalPowerSum / capacity) * 100;

      return {
        region: data.region,
        timestamp: new Date().toISOString(),
        meterCount: data.meterCount,
        totalConsumption: data.totalPowerSum,
        avgConsumption: data.totalPowerSum / data.meterCount,
        maxConsumption: data.maxPower,
        minConsumption: data.minPower === Infinity ? 0 : data.minPower,
        loadPercentage: parseFloat(loadPercentage.toFixed(2)),
        activeMeters: Array.from(data.meterIds),
      };
    });
  }

  // * Get all 15-minute aggregates that are ready to flush
  getReadyAggregates15m(): Array<Aggregate15m> {
    const currentBucket = get15MinuteBucket(new Date());
    const aggregates: Array<Aggregate15m> = [];

    for (const [bucket, meterMap] of this.windows15m.entries()) {

      // ? Only flush buckets older than current 15-minute window
      if (bucket < currentBucket) {
        for (const [meterId, window] of meterMap.entries()) {
          aggregates.push({
            meterId, region: window.region,
            windowStart: new Date(bucket), avgPowerKw: window.powerSum / window.count,
            maxPowerKw: window.maxPower, energyKwhSum: window.energySum, count: window.count
          });
        }
      }
    }
    return aggregates;
  }

  // * Clear flushed 1-minute windows
  public clearFlushedWindows1m(): number {
    const currentBucket = get1MinuteBucket(new Date());
    let cleared = 0;

    for (const bucket of this.windows1m.keys()) {
      if (bucket < currentBucket) {
        this.windows1m.delete(bucket);
        cleared++;
      }
    }
    if (cleared > 0) logger.debug({ cleared }, 'Cleared flushed 1m windows');
    return cleared;
  }

  // * Clear flushed 15-minute windows
  public clearFlushedWindows15m(): number {
    const currentBucket = get15MinuteBucket(new Date());
    let cleared = 0;

    for (const bucket of this.windows15m.keys()) {
      if (bucket < currentBucket) {
        this.windows15m.delete(bucket);
        cleared++;
      }
    }
    if (cleared > 0) logger.debug({ cleared }, 'Cleared flushed 15m windows');
    return cleared;
  }

  // * Get current average power f`or a meter (from current 1m window)
  public getCurrentAvgPowerForMeter(meterId: string): number | null {
    const currentBucket = get1MinuteBucket(new Date());
    const bucketMap = this.windows1m.get(currentBucket);

    if (!bucketMap || !bucketMap.has(meterId)) return null;
    const window = bucketMap.get(meterId)!;

    return window.powerSum / window.count;
  }

  // * Get statistics for monitoring

  public getStats(): StatSummary {
    const StatValues = {} as StatValues;

    for (const meterMap of this.windows1m.values()) {
      StatValues.totalMeters1m += meterMap.size;
      for (const window of meterMap.values()) { StatValues.totalReadings1m += window.count; }
    }
    for (const meterMap of this.windows15m.values()) {
      StatValues.totalMeters15m += meterMap.size;
      for (const window of meterMap.values()) { StatValues.totalReadings15m += window.count; }
    }
    return {
      windows1m: { buckets: this.windows1m.size, meters: StatValues.totalMeters1m, readings: StatValues.totalReadings1m },
      windows15m: { buckets: this.windows15m.size, meters: StatValues.totalMeters15m, readings: StatValues.totalReadings15m, },
    };
  }

  //   * Clear all windows (for testing or reset)
  public clearAll(): void {
    this.windows1m.clear(); this.windows15m.clear();
    this.oldestBucket1m = null; this.oldestBucket15m = null;
    logger.info('Cleared all aggregation windows');
  }
}
