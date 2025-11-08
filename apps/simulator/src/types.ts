import { TelemetryReading } from '@segs/shared-types';

// * Configuration for the simulator.
export interface SimulatorConfig {
  meters: number;  
  interval: number;  
  mode: SimulationMode;  
  target: TargetMode;  
  ingestionUrl: string; 
  kafkaBrokers: Array<string>;  
  kafkaTopic: string;  

  kafkaClientId: string;  

  availableRegions: Array<string>;  
  regions: Array<string>;
  duplicateRate: number;  
  batchSize: number;  
  concurrencyLimit: number;  
  iterations: number;  

  logLevel: string;  

  metricsEnabled: boolean;  
  metricsPort: number;  

  retryAttempts: number;  
  retryDelayMs: number;  

  minVoltage: number;  
  maxVoltage: number;  

  baseLoadMinKw: number;  
  baseLoadMaxKw: number;  
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
