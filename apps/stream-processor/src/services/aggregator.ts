/**
 * Aggregator Service
 * 
 * Maintains in-memory sliding windows for 1-minute and 15-minute aggregations.
 * Computes statistics and flushes to database and Kafka on schedule.
 */

import type { TelemetryReading } from '@segs/shared-types';
import { get1MinuteBucket, get15MinuteBucket } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';
import type { Aggregate1m, Aggregate15m } from '../db/timescale.js';

const logger = createLogger('aggregator');

interface AggregateWindow {
  meterId: string;
  region: string;
  powerSum: number;
  maxPower: number;
  energySum: number;
  count: number;
}

/**
 * Aggregator Service
 * 
 * Maintains in-memory windows and computes statistics
 */
export class AggregatorService {
  // Map: windowBucket -> meterId -> aggregates
  private windows1m: Map<string, Map<string, AggregateWindow>> = new Map();
  private windows15m: Map<string, Map<string, AggregateWindow>> = new Map();

  // Track oldest bucket for cleanup
  private oldestBucket1m: string | null = null;
  private oldestBucket15m: string | null = null;

  /**
   * Process a single telemetry reading
   */
  processReading(reading: TelemetryReading): void {
    try {
      // Update 1-minute window
      const bucket1m = get1MinuteBucket(reading.timestamp);
      this.updateWindow(this.windows1m, bucket1m, reading);

      // Update 15-minute window
      const bucket15m = get15MinuteBucket(reading.timestamp);
      this.updateWindow(this.windows15m, bucket15m, reading);

      // Track oldest buckets
      if (!this.oldestBucket1m || bucket1m < this.oldestBucket1m) {
        this.oldestBucket1m = bucket1m;
      }
      if (!this.oldestBucket15m || bucket15m < this.oldestBucket15m) {
        this.oldestBucket15m = bucket15m;
      }

      logger.debug(
        {
          meterId: reading.meterId,
          bucket1m,
          bucket15m,
          powerKw: reading.powerKw,
        },
        'Reading processed'
      );
    } catch (error) {
      logger.error({ error, reading }, 'Error processing reading');
    }
  }

  /**
   * Update a specific window with reading data
   */
  private updateWindow(
    windowsMap: Map<string, Map<string, AggregateWindow>>,
    bucket: string,
    reading: TelemetryReading
  ): void {
    // Get or create bucket
    if (!windowsMap.has(bucket)) {
      windowsMap.set(bucket, new Map());
    }

    const bucketMap = windowsMap.get(bucket)!;

    // Get or create meter aggregate
    if (!bucketMap.has(reading.meterId)) {
      bucketMap.set(reading.meterId, {
        meterId: reading.meterId,
        region: reading.region,
        powerSum: 0,
        maxPower: 0,
        energySum: 0,
        count: 0,
      });
    }

    const aggregate = bucketMap.get(reading.meterId)!;

    // Update aggregate
    aggregate.powerSum += reading.powerKw;
    aggregate.maxPower = Math.max(aggregate.maxPower, reading.powerKw);
    aggregate.energySum += reading.energyKwh || 0;
    aggregate.count += 1;

    // Ensure region is set (in case it changed, use latest)
    aggregate.region = reading.region;
  }

  /**
   * Get all 1-minute aggregates that are ready to flush
   * Returns aggregates older than the current minute
   */
  getReadyAggregates1m(): Aggregate1m[] {
    const currentBucket = get1MinuteBucket(new Date());
    const aggregates: Aggregate1m[] = [];

    for (const [bucket, meterMap] of this.windows1m.entries()) {
      // Only flush buckets older than current minute
      if (bucket < currentBucket) {
        for (const [meterId, window] of meterMap.entries()) {
          aggregates.push({
            meterId,
            region: window.region,
            windowStart: new Date(bucket),
            avgPowerKw: window.powerSum / window.count,
            maxPowerKw: window.maxPower,
            energyKwhSum: window.energySum,
            count: window.count,
          });
        }
      }
    }

    return aggregates;
  }

  /**
   * Get all 15-minute aggregates that are ready to flush
   */
  getReadyAggregates15m(): Aggregate15m[] {
    const currentBucket = get15MinuteBucket(new Date());
    const aggregates: Aggregate15m[] = [];

    for (const [bucket, meterMap] of this.windows15m.entries()) {
      // Only flush buckets older than current 15-minute window
      if (bucket < currentBucket) {
        for (const [meterId, window] of meterMap.entries()) {
          aggregates.push({
            meterId,
            region: window.region,
            windowStart: new Date(bucket),
            avgPowerKw: window.powerSum / window.count,
            maxPowerKw: window.maxPower,
            energyKwhSum: window.energySum,
            count: window.count,
          });
        }
      }
    }

    return aggregates;
  }

  /**
   * Clear flushed 1-minute windows
   */
  clearFlushedWindows1m(): number {
    const currentBucket = get1MinuteBucket(new Date());
    let cleared = 0;

    for (const bucket of this.windows1m.keys()) {
      if (bucket < currentBucket) {
        this.windows1m.delete(bucket);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.debug({ cleared }, 'Cleared flushed 1m windows');
    }

    return cleared;
  }

  /**
   * Clear flushed 15-minute windows
   */
  clearFlushedWindows15m(): number {
    const currentBucket = get15MinuteBucket(new Date());
    let cleared = 0;

    for (const bucket of this.windows15m.keys()) {
      if (bucket < currentBucket) {
        this.windows15m.delete(bucket);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.debug({ cleared }, 'Cleared flushed 15m windows');
    }

    return cleared;
  }

  /**
   * Get current average power for a meter (from current 1m window)
   */
  getCurrentAvgPowerForMeter(meterId: string): number | null {
    const currentBucket = get1MinuteBucket(new Date());
    const bucketMap = this.windows1m.get(currentBucket);

    if (!bucketMap || !bucketMap.has(meterId)) {
      return null;
    }

    const window = bucketMap.get(meterId)!;
    return window.powerSum / window.count;
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    let totalMeters1m = 0;
    let totalReadings1m = 0;
    let totalMeters15m = 0;
    let totalReadings15m = 0;

    for (const meterMap of this.windows1m.values()) {
      totalMeters1m += meterMap.size;
      for (const window of meterMap.values()) {
        totalReadings1m += window.count;
      }
    }

    for (const meterMap of this.windows15m.values()) {
      totalMeters15m += meterMap.size;
      for (const window of meterMap.values()) {
        totalReadings15m += window.count;
      }
    }

    return {
      windows1m: {
        buckets: this.windows1m.size,
        meters: totalMeters1m,
        readings: totalReadings1m,
      },
      windows15m: {
        buckets: this.windows15m.size,
        meters: totalMeters15m,
        readings: totalReadings15m,
      },
    };
  }

  /**
   * Clear all windows (for testing or reset)
   */
  clearAll(): void {
    this.windows1m.clear();
    this.windows15m.clear();
    this.oldestBucket1m = null;
    this.oldestBucket15m = null;
    logger.info('Cleared all aggregation windows');
  }
}
