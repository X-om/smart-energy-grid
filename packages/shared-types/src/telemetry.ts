export interface TelemetryReading {
  readingId: string;
  meterId: string;
  userId?: string;
  timestamp: string;

  powerKw: number; // Current power consumption in kilowatts
  energyKwh?: number; // Energy consumed in kilowatt-hours (optional, calculated)
  voltage?: number; // Voltage measurement in volts (optional)
  region: string; // Geographic region of the meter (e.g., 'north', 'south', 'east', 'west')
  seq?: number; // Sequence number for ordering readings from the same meter
  status?: 'OK' | 'ERROR'; // Status of the reading

  metadata?: Record<string, unknown>;
}

// * Type guard to check if an object is a valid TelemetryReading
export const isTelemetryReading = (obj: unknown): obj is TelemetryReading => {
  const reading = obj as TelemetryReading;
  return (
    typeof reading === 'object' && reading !== null && typeof reading.readingId === 'string' && typeof reading.meterId === 'string' &&
    typeof reading.timestamp === 'string' && typeof reading.powerKw === 'number' && typeof reading.region === 'string'
  );
}
