/**
 * Anomaly Detector Service
 * 
 * Detects sudden changes in power consumption patterns
 * that may indicate anomalies, faults, or unusual behavior.
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js';
import type { Alert } from '../kafka/producer.js';
import type { TelemetryReading } from '@segs/shared-types';
import type { TimescaleDBService } from '../db/timescale.js';

const logger = createLogger('anomaly-detector');

export interface AnomalyDetectorConfig {
  spikeThreshold: number; // Default 1.0 (100% increase)
  dropThreshold: number; // Default 0.5 (50% decrease)
  minSampleSize: number; // Minimum readings before detecting anomalies
}

/**
 * Anomaly Detector Service
 * 
 * Compares current readings against historical baselines
 */
export class AnomalyDetectorService {
  private config: AnomalyDetectorConfig;
  private db: TimescaleDBService;
  private baselineCache: Map<string, number> = new Map(); // meterId -> baseline avg power
  private readingCounts: Map<string, number> = new Map(); // meterId -> reading count

  constructor(db: TimescaleDBService, config?: Partial<AnomalyDetectorConfig>) {
    this.db = db;
    this.config = {
      spikeThreshold: config?.spikeThreshold ?? 1.0, // 100% increase
      dropThreshold: config?.dropThreshold ?? 0.5, // 50% decrease
      minSampleSize: config?.minSampleSize ?? 10,
    };
  }

  /**
   * Check a reading for anomalies
   * Returns alert if anomaly detected, null otherwise
   */
  async checkReading(reading: TelemetryReading): Promise<Alert | null> {
    try {
      const { meterId, powerKw, region, timestamp } = reading;

      // Increment reading count
      const count = (this.readingCounts.get(meterId) || 0) + 1;
      this.readingCounts.set(meterId, count);

      // Skip detection if not enough samples yet
      if (count < this.config.minSampleSize) {
        logger.debug({ meterId, count }, 'Insufficient samples for anomaly detection');
        return null;
      }

      // Get baseline (from cache or DB)
      let baseline = this.baselineCache.get(meterId);

      if (baseline === undefined) {
        // Fetch from database
        const dbBaseline = await this.db.getLastAvgPowerForMeter(meterId);

        if (dbBaseline !== null) {
          baseline = dbBaseline;
          this.baselineCache.set(meterId, baseline);
        } else {
          // No historical data yet, cache current value as baseline
          this.baselineCache.set(meterId, powerKw);
          return null;
        }
      }

      // Calculate change percentage
      const change = (powerKw - baseline) / baseline;
      const changePercent = Math.abs(change) * 100;

      // Check for spike (sudden increase)
      if (change > this.config.spikeThreshold) {
        logger.warn(
          {
            meterId,
            baseline,
            current: powerKw,
            changePercent: changePercent.toFixed(1),
          },
          'Power consumption spike detected'
        );

        return this.createAlert({
          type: 'ANOMALY',
          severity: change > 2.0 ? 'ERROR' : 'WARN',
          meterId,
          region,
          timestamp,
          message: `Sudden power consumption spike: ${changePercent.toFixed(1)}% increase (baseline: ${baseline.toFixed(2)} kW, current: ${powerKw.toFixed(2)} kW)`,
          metadata: {
            baseline,
            current: powerKw,
            change: changePercent,
            type: 'spike',
          },
        });
      }

      // Check for drop (sudden decrease)
      if (change < -this.config.dropThreshold) {
        logger.warn(
          {
            meterId,
            baseline,
            current: powerKw,
            changePercent: changePercent.toFixed(1),
          },
          'Power consumption drop detected'
        );

        return this.createAlert({
          type: 'ANOMALY',
          severity: change < -0.8 ? 'WARN' : 'INFO',
          meterId,
          region,
          timestamp,
          message: `Sudden power consumption drop: ${changePercent.toFixed(1)}% decrease (baseline: ${baseline.toFixed(2)} kW, current: ${powerKw.toFixed(2)} kW)`,
          metadata: {
            baseline,
            current: powerKw,
            change: changePercent,
            type: 'drop',
          },
        });
      }

      // Check for near-zero consumption (possible outage)
      if (powerKw < 0.1 && baseline > 1.0) {
        logger.warn(
          {
            meterId,
            baseline,
            current: powerKw,
          },
          'Possible outage detected'
        );

        return this.createAlert({
          type: 'ANOMALY',
          severity: 'ERROR',
          meterId,
          region,
          timestamp,
          message: `Possible outage: power consumption near zero (baseline: ${baseline.toFixed(2)} kW, current: ${powerKw.toFixed(2)} kW)`,
          metadata: {
            baseline,
            current: powerKw,
            type: 'outage',
          },
        });
      }

      // Update baseline with exponential moving average (20% weight to new value)
      const newBaseline = baseline * 0.8 + powerKw * 0.2;
      this.baselineCache.set(meterId, newBaseline);

      return null;
    } catch (error) {
      logger.error({ error, reading }, 'Error detecting anomaly');
      return null;
    }
  }

  /**
   * Check a batch of readings for anomalies
   */
  async checkReadings(readings: TelemetryReading[]): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const reading of readings) {
      const alert = await this.checkReading(reading);
      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Create an alert object
   */
  private createAlert(params: {
    type: Alert['type'];
    severity: Alert['severity'];
    meterId: string;
    region: string;
    timestamp: string;
    message: string;
    metadata?: Record<string, any>;
  }): Alert {
    return {
      alertId: uuidv4(),
      type: params.type,
      severity: params.severity,
      meterId: params.meterId,
      region: params.region,
      message: params.message,
      timestamp: params.timestamp,
      metadata: params.metadata,
    };
  }

  /**
   * Update baseline for a meter manually
   */
  updateBaseline(meterId: string, baseline: number): void {
    this.baselineCache.set(meterId, baseline);
    logger.debug({ meterId, baseline }, 'Baseline updated');
  }

  /**
   * Get current baseline for a meter
   */
  getBaseline(meterId: string): number | undefined {
    return this.baselineCache.get(meterId);
  }

  /**
   * Clear baseline cache
   */
  clearCache(): void {
    this.baselineCache.clear();
    this.readingCounts.clear();
    logger.info('Anomaly detector cache cleared');
  }

  /**
   * Get detector statistics
   */
  getStats() {
    return {
      cachedBaselines: this.baselineCache.size,
      trackedMeters: this.readingCounts.size,
      config: this.config,
    };
  }
}
