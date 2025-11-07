/**
 * Internal types for the Telemetry Simulator service.
 * Separate from shared-types as these are simulator-specific.
 */

import { TelemetryReading } from '@segs/shared-types';

/**
 * Configuration for the simulator.
 */
export interface SimulatorConfig {
  /** Number of virtual meters to simulate */
  meters: number;

  /** Interval between readings in seconds */
  interval: number;

  /** Simulation mode */
  mode: SimulationMode;

  /** Target destination for readings */
  target: TargetMode;

  /** HTTP ingestion endpoint URL */
  ingestionUrl: string;

  /** Kafka broker addresses */
  kafkaBrokers: string[];

  /** Kafka topic name */
  kafkaTopic: string;

  /** Kafka client ID */
  kafkaClientId: string;

  /** Available regions */
  regions: string[];

  /** Rate of duplicate readings (0.0 to 1.0) */
  duplicateRate: number;

  /** Batch size for HTTP requests */
  batchSize: number;

  /** Maximum concurrent requests */
  concurrencyLimit: number;

  /** Number of iterations (0 = infinite) */
  iterations: number;

  /** Log level */
  logLevel: string;

  /** Whether metrics are enabled */
  metricsEnabled: boolean;

  /** Metrics server port */
  metricsPort: number;

  /** Number of retry attempts */
  retryAttempts: number;

  /** Initial retry delay in milliseconds */
  retryDelayMs: number;

  /** Minimum voltage */
  minVoltage: number;

  /** Maximum voltage */
  maxVoltage: number;

  /** Minimum base load in kW */
  baseLoadMinKw: number;

  /** Maximum base load in kW */
  baseLoadMaxKw: number;
}

/**
 * Simulation modes affecting power generation patterns.
 */
export type SimulationMode = 'normal' | 'peak' | 'outage';

/**
 * Target destinations for telemetry data.
 */
export type TargetMode = 'http' | 'kafka';

/**
 * Represents a virtual smart meter in the simulation.
 */
export interface VirtualMeter {
  meterId: string;

  /** Optional user ID associated with this meter */
  userId?: string;

  /** Geographic region */
  region: string;

  /** Baseline power consumption in kW */
  baseLoadKw: number;

  /** Sequence number for this meter's readings */
  seq: number;
}

/**
 * Statistics for a simulation cycle.
 */
export interface CycleStats {
  /** Cycle number */
  cycle: number;

  /** Total readings generated */
  readingsGenerated: number;

  /** Total readings sent successfully */
  readingsSent: number;

  /** Total errors encountered */
  errors: number;

  /** Average latency in milliseconds */
  avgLatencyMs: number;

  /** Timestamp when the cycle started */
  startTime: number;

  /** Timestamp when the cycle ended */
  endTime: number;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Cumulative statistics across all cycles.
 */
export interface CumulativeStats {
  /** Total cycles completed */
  totalCycles: number;

  /** Total readings generated */
  totalReadings: number;

  /** Total readings sent successfully */
  totalSent: number;

  /** Total errors */
  totalErrors: number;

  /** Average latency across all cycles */
  avgLatencyMs: number;

  /** Simulator start time */
  startTime: number;

  /** Last cycle stats */
  lastCycle?: CycleStats;
}

/**
 * Batch of telemetry readings for sending.
 */
export interface ReadingBatch {
  /** Array of telemetry readings */
  readings: TelemetryReading[];

  /** Batch identifier */
  batchId: string;

  /** Timestamp when batch was created */
  timestamp: string;
}

/**
 * Response from sending a batch (HTTP mode).
 */
export interface BatchResponse {
  /** Whether the batch was successful */
  success: boolean;

  /** Number of readings accepted */
  accepted: number;

  /** Number of readings rejected */
  rejected?: number;

  /** Error message if failed */
  error?: string;

  /** Latency in milliseconds */
  latencyMs: number;
}

/**
 * Metrics for Prometheus export.
 */
export interface SimulatorMetrics {
  /** Total messages sent */
  messagesSentTotal: number;

  /** Total errors */
  errorsTotal: number;

  /** Average latency in milliseconds */
  latencyAvgMs: number;

  /** Current active meters */
  activeMeters: number;

  /** Readings per second */
  readingsPerSecond: number;
}
