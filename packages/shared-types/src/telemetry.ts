/**
 * Telemetry data models for smart meter readings.
 * Used by simulator, ingestion service, and stream processor.
 */

/**
 * Represents a single telemetry reading from a smart meter.
 * This is the core data structure for all power consumption measurements.
 */
export interface TelemetryReading {
  /** Unique identifier for this reading (UUID v4) */
  readingId: string;

  /** Unique identifier of the meter that produced this reading */
  meterId: string;

  /** Optional user ID associated with this meter */
  userId?: string;

  /** ISO 8601 timestamp when the reading was taken */
  timestamp: string;

  /** Current power consumption in kilowatts */
  powerKw: number;

  /** Energy consumed in kilowatt-hours (optional, calculated) */
  energyKwh?: number;

  /** Voltage measurement in volts (optional) */
  voltage?: number;

  /** Geographic region of the meter (e.g., 'north', 'south', 'east', 'west') */
  region: string;

  /** Sequence number for ordering readings from the same meter */
  seq?: number;

  /** Status of the reading */
  status?: 'OK' | 'ERROR';

  /** Additional metadata for the reading (e.g., temperature, humidity) */
  metadata?: Record<string, unknown>;
}

/**
 * Type guard to check if an object is a valid TelemetryReading
 */
export function isTelemetryReading(obj: unknown): obj is TelemetryReading {
  const reading = obj as TelemetryReading;
  return (
    typeof reading === 'object' &&
    reading !== null &&
    typeof reading.readingId === 'string' &&
    typeof reading.meterId === 'string' &&
    typeof reading.timestamp === 'string' &&
    typeof reading.powerKw === 'number' &&
    typeof reading.region === 'string'
  );
}
