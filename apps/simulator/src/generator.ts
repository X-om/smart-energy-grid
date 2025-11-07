/**
 * Telemetry data generator.
 * Creates realistic smart meter readings based on simulation mode.
 */

import { v4 as uuidv4 } from 'uuid';
import { TelemetryReading } from '@segs/shared-types';
import { SimulatorConfig, VirtualMeter, SimulationMode } from './types.js';
import { logger } from './utils/logger.js';

/**
 * Generate an array of virtual meters.
 */
export function initializeMeters(config: SimulatorConfig): VirtualMeter[] {
  logger.info({ count: config.meters, regions: config.regions }, 'Initializing virtual meters');

  const meters: VirtualMeter[] = [];
  const regionsCount = config.regions.length;

  for (let i = 0; i < config.meters; i++) {
    const region = config.regions[i % regionsCount];
    const baseLoadKw = randomBetween(config.baseLoadMinKw, config.baseLoadMaxKw);

    meters.push({
      meterId: `MTR-${String(i + 1).padStart(8, '0')}`,
      userId: `USR-${String(Math.floor(i / 2) + 1).padStart(8, '0')}`, // 2 meters per user
      region,
      baseLoadKw: Number(baseLoadKw.toFixed(2)),
      seq: 0,
    });
  }

  logger.info(
    {
      totalMeters: meters.length,
      regionDistribution: countByRegion(meters),
    },
    'Virtual meters initialized'
  );

  return meters;
}

/**
 * Count meters by region.
 */
function countByRegion(meters: VirtualMeter[]): Record<string, number> {
  return meters.reduce((acc, meter) => {
    acc[meter.region] = (acc[meter.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Generate telemetry readings for all meters.
 */
export function generateReadings(
  meters: VirtualMeter[],
  config: SimulatorConfig
): TelemetryReading[] {
  const readings: TelemetryReading[] = [];
  const timestamp = new Date().toISOString();

  for (const meter of meters) {
    // Increment sequence number
    meter.seq++;

    // Generate reading
    const reading = generateReading(meter, config, timestamp);
    readings.push(reading);

    // Occasionally add duplicate (based on duplicate rate)
    if (Math.random() < config.duplicateRate) {
      // Create duplicate with same readingId and data
      readings.push({ ...reading });
    }
  }

  return readings;
}

/**
 * Generate a single telemetry reading for a meter.
 */
function generateReading(
  meter: VirtualMeter,
  config: SimulatorConfig,
  timestamp: string
): TelemetryReading {
  const mode = config.mode;

  // Calculate power based on simulation mode
  const powerKw = calculatePower(meter.baseLoadKw, mode);

  // Calculate energy (power * time interval)
  const energyKwh = (powerKw * config.interval) / 3600; // Convert seconds to hours

  // Generate voltage with slight variation
  const voltage = randomBetween(config.minVoltage, config.maxVoltage);

  // Determine status
  const status = mode === 'outage' && Math.random() < 0.1 ? 'ERROR' : 'OK';

  const reading: TelemetryReading = {
    readingId: uuidv4(),
    meterId: meter.meterId,
    userId: meter.userId,
    timestamp,
    powerKw: Number(powerKw.toFixed(3)),
    energyKwh: Number(energyKwh.toFixed(4)),
    voltage: Number(voltage.toFixed(1)),
    region: meter.region,
    seq: meter.seq,
    status,
    metadata: {
      mode,
      baseLoad: meter.baseLoadKw,
    },
  };

  return reading;
}

/**
 * Calculate power consumption based on base load and simulation mode.
 */
function calculatePower(baseLoadKw: number, mode: SimulationMode): number {
  switch (mode) {
    case 'normal':
      // Normal variation: 0.8 to 1.2 times base load
      return baseLoadKw * randomBetween(0.8, 1.2);

    case 'peak':
      // Peak hours: 1.5 to 2.0 times base load
      return baseLoadKw * randomBetween(1.5, 2.0);

    case 'outage':
      // Outage simulation: 0 to 0.3 times base load (mostly offline)
      return Math.random() < 0.3 ? baseLoadKw * randomBetween(0, 0.3) : 0;

    default:
      return baseLoadKw;
  }
}

/**
 * Generate a random number between min and max (inclusive).
 */
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Shuffle array in place (Fisher-Yates shuffle).
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Chunk array into smaller batches.
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
