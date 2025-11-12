export interface TelemetryReading {
  readingId: string;
  meterId: string;
  userId?: string;
  timestamp: string;

  powerKw: number;
  energyKwh?: number;
  voltage?: number;
  region: string;
  seq?: number;
  status?: 'OK' | 'ERROR';
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
