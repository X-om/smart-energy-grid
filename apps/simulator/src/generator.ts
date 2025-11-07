import { v4 as uuidv4 } from 'uuid';
import { TelemetryReading } from '@segs/shared-types';
import { SimulatorConfig, VirtualMeter, SimulationMode } from './types.js';
import { logger } from './utils/logger.js';

// * Generate an array of virtual meters.
export const initializeMeters = (config: SimulatorConfig): Array<VirtualMeter> => {
  logger.info({ count: config.meters, regions: config.regions }, 'Initializing virtual meters');

  const meters: Array<VirtualMeter> = [];
  const regionsCount = config.regions.length;

  for (let i = 0; i < config.meters; i++) {
    const region = config.regions[i % regionsCount];
    const baseLoadKw = randomBetween(config.baseLoadMinKw, config.baseLoadMaxKw);

    meters.push({
      meterId: `MTR-${String(i + 1).padStart(8, '0')}`,
      userId: `USR-${String(Math.floor(i / 2) + 1).padStart(8, '0')}`, // 2 meters per user
      region, baseLoadKw: Number(baseLoadKw.toFixed(2)), seq: 0,
    });
  }

  logger.info({ totalMeters: meters.length, regionDistribution: countByRegion(meters), }, 'Virtual meters initialized');
  return meters;
}

// * Count meters by region.
const countByRegion = (meters: Array<VirtualMeter>): Record<string, number> =>
  meters.reduce((acc, meter) => {
    acc[meter.region] = (acc[meter.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);


// * Generate telemetry readings for all meters.
export const generateReadings = (meters: Array<VirtualMeter>, config: SimulatorConfig): Array<TelemetryReading> => {
  const readings: Array<TelemetryReading> = [];
  const timestamp = new Date().toISOString();

  for (const meter of meters) {
    meter.seq++;
    const reading = generateReading(meter, config, timestamp);
    readings.push(reading);

    if (Math.random() < config.duplicateRate)
      readings.push({ ...reading });
  }
  return readings;
}

// * Generate a single telemetry reading for a meter.
const generateReading = (meter: VirtualMeter, config: SimulatorConfig, timestamp: string): TelemetryReading => {
  const mode = config.mode;
  const powerKw = calculatePower(meter.baseLoadKw, mode);

  const energyKwh = (powerKw * config.interval) / 3600;
  const voltage = randomBetween(config.minVoltage, config.maxVoltage);

  const status = mode === 'outage' && Math.random() < 0.1 ? 'ERROR' : 'OK';
  const reading: TelemetryReading = {
    readingId: uuidv4(), meterId: meter.meterId, userId: meter.userId,
    timestamp, powerKw: Number(powerKw.toFixed(3)),
    energyKwh: Number(energyKwh.toFixed(4)),
    voltage: Number(voltage.toFixed(1)),
    region: meter.region, seq: meter.seq,
    status, metadata: { mode, baseLoad: meter.baseLoadKw, }
  };
  
  return reading;
}

// * Calculate power consumption based on base load and simulation mode.
const calculatePower = (baseLoadKw: number, mode: SimulationMode): number => {
  switch (mode) {
    case 'normal': return baseLoadKw * randomBetween(0.8, 1.2);
    case 'peak': return baseLoadKw * randomBetween(1.5, 2.0);
    case 'outage': return Math.random() < 0.3 ? baseLoadKw * randomBetween(0, 0.3) : 0;
    default: return baseLoadKw;
  }
}

// * Generate a random number between min and max(inclusive).
const randomBetween = (min: number, max: number): number => Math.random() * (max - min) + min;

// * Shuffle array in place (Fisher-Yates shuffle).
export const shuffleArray = <T>(array: Array<T>): Array<T> => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// * Chunk array into smaller batches.
export const chunkArray = <T>(array: Array<T>, chunkSize: number): Array<Array<T>> => {
  const chunks: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};
