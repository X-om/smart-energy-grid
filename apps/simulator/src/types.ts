import { TelemetryReading } from '@segs/shared-types';

// * Configuration for the simulator.
export interface SimulatorConfig {
  meters: number; // Number of virtual meters to simulate
  interval: number; // Interval between readings in seconds
  mode: SimulationMode; // Simulation mode
  target: TargetMode; // Target destination for readings
  ingestionUrl: string; // HTTP ingestion endpoint URL
  kafkaBrokers: Array<string>; // Kafka broker addresses
  kafkaTopic: string; // Kafka topic name

  kafkaClientId: string; // Kafka client ID

  availableRegions: Array<string>; // Available regions
  regions: Array<string>;
  duplicateRate: number; // Rate of duplicate readings (0.0 to 1.0)
  batchSize: number; // Batch size for HTTP requests
  concurrencyLimit: number; // Maximum concurrent requests
  iterations: number; // Number of iterations (0 = infinite)

  logLevel: string; // Log level

  metricsEnabled: boolean; // Whether metrics are enabled
  metricsPort: number; // Metrics server port

  retryAttempts: number; // Number of retry attempts
  retryDelayMs: number; // Initial retry delay in milliseconds

  minVoltage: number; // Minimum voltage
  maxVoltage: number; // Maximum voltage

  baseLoadMinKw: number; // Minimum base load in kW
  baseLoadMaxKw: number; // Maximum base load in kW
}


export type SimulationMode = 'normal' | 'peak' | 'outage';
export type TargetMode = 'http' | 'kafka';

export interface VirtualMeter {
  meterId: string;
  userId?: string;
  region: string;
  baseLoadKw: number; // Baseline power consumption in kW
  seq: number; // Sequence number for this meter's readings
}

// * Statistics for a simulation cycle.
export interface CycleStats {
  cycle: number;
  readingsGenerated: number;
  readingsSent: number;
  errors: number;
  avgLatencyMs: number;
  startTime: number;
  endTime: number;
  durationMs: number;
}

// * Cumulative statistics across all cycles.
export interface CumulativeStats {
  totalCycles: number;
  totalReadings: number;
  totalSent: number;
  totalErrors: number;
  avgLatencyMs: number;
  startTime: number;
  lastCycle?: CycleStats;
}

// * Batch of telemetry readings for sending.
export interface ReadingBatch {
  readings: Array<TelemetryReading>;
  batchId: string;
  timestamp: string;
}

// * Response from sending a batch (HTTP mode).
export interface BatchResponse {
  success: boolean;
  accepted: number;
  rejected?: number;
  error?: string;
  latencyMs: number;
}

// * Metrics for Prometheus export.
export interface SimulatorMetrics {
  messagesSentTotal: number;
  errorsTotal: number;
  latencyAvgMs: number;
  activeMeters: number;
  readingsPerSecond: number;
}
