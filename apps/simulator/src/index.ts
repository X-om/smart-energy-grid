/**
 * Smart Energy Grid Telemetry Simulator
 * 
 * Main entry point for the telemetry simulator service.
 * Simulates thousands of virtual smart meters sending power consumption data.
 */

import { loadConfig, parseCliArgs } from './config.js';
import { initializeMeters, generateReadings } from './generator.js';
import { createSender } from './sender.js';
import { logger } from './utils/logger.js';
import {
  SimulatorConfig,
  VirtualMeter,
  CycleStats,
  CumulativeStats,
} from './types.js';

/**
 * Main simulator class.
 */
class TelemetrySimulator {
  private config: SimulatorConfig;
  private meters: VirtualMeter[] = [];
  private sender: ReturnType<typeof createSender>;
  private stats: CumulativeStats;
  private running = false;
  private currentCycle = 0;

  constructor(config: SimulatorConfig) {
    this.config = config;
    this.sender = createSender(config);
    this.stats = {
      totalCycles: 0,
      totalReadings: 0,
      totalSent: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Initialize the simulator.
   */
  async initialize(): Promise<void> {
    logger.info('Initializing telemetry simulator');

    // Generate virtual meters
    this.meters = initializeMeters(this.config);

    logger.info(
      {
        config: {
          meters: this.config.meters,
          interval: this.config.interval,
          mode: this.config.mode,
          target: this.config.target,
          regions: this.config.regions,
          iterations: this.config.iterations === 0 ? 'infinite' : this.config.iterations,
        },
      },
      'Simulator initialized'
    );
  }

  /**
   * Start the simulation.
   */
  async start(): Promise<void> {
    this.running = true;

    logger.info(
      {
        meters: this.config.meters,
        interval: `${this.config.interval}s`,
        mode: this.config.mode,
        target: this.config.target,
        url: this.config.target === 'http' ? this.config.ingestionUrl : undefined,
        topic: this.config.target === 'kafka' ? this.config.kafkaTopic : undefined,
      },
      '🚀 Starting telemetry simulator'
    );

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    // Start simulation loop
    await this.simulationLoop();
  }

  /**
   * Main simulation loop.
   */
  private async simulationLoop(): Promise<void> {
    const { interval, iterations } = this.config;
    const isInfinite = iterations === 0;

    while (this.running) {
      this.currentCycle++;

      // Check if we've reached the iteration limit
      if (!isInfinite && this.currentCycle > iterations) {
        logger.info({ totalCycles: this.currentCycle - 1 }, 'Completed all iterations');
        break;
      }

      // Run simulation cycle
      await this.runCycle();

      // Wait for next interval (if still running)
      if (this.running && (isInfinite || this.currentCycle < iterations)) {
        await this.sleep(interval * 1000);
      }
    }

    // Clean up
    await this.stop();
  }

  /**
   * Run a single simulation cycle.
   */
  private async runCycle(): Promise<void> {
    const cycleStart = Date.now();

    try {
      // Generate readings for all meters
      const readings = generateReadings(this.meters, this.config);

      logger.debug(
        { cycle: this.currentCycle, readings: readings.length },
        'Generated readings'
      );

      // Send readings
      const responses = await this.sender.send(readings);

      // Calculate cycle statistics
      const cycleStats = this.calculateCycleStats(
        readings.length,
        responses,
        cycleStart
      );

      // Update cumulative statistics
      this.updateStats(cycleStats);

      // Log cycle summary
      this.logCycleSummary(cycleStats);
    } catch (error) {
      logger.error(
        { cycle: this.currentCycle, error },
        'Error during simulation cycle'
      );
      this.stats.totalErrors++;
    }
  }

  /**
   * Calculate statistics for a cycle.
   */
  private calculateCycleStats(
    readingsGenerated: number,
    responses: Array<{ success: boolean; accepted: number; latencyMs: number }>,
    startTime: number
  ): CycleStats {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const readingsSent = responses.reduce(
      (sum, r) => sum + (r.success ? r.accepted : 0),
      0
    );

    const errors = responses.reduce((sum, r) => sum + (r.success ? 0 : 1), 0);

    const totalLatency = responses.reduce((sum, r) => sum + r.latencyMs, 0);
    const avgLatencyMs = responses.length > 0 ? totalLatency / responses.length : 0;

    return {
      cycle: this.currentCycle,
      readingsGenerated,
      readingsSent,
      errors,
      avgLatencyMs: Math.round(avgLatencyMs),
      startTime,
      endTime,
      durationMs,
    };
  }

  /**
   * Update cumulative statistics.
   */
  private updateStats(cycleStats: CycleStats): void {
    this.stats.totalCycles++;
    this.stats.totalReadings += cycleStats.readingsGenerated;
    this.stats.totalSent += cycleStats.readingsSent;
    this.stats.totalErrors += cycleStats.errors;

    // Update rolling average latency
    const totalCycles = this.stats.totalCycles;
    this.stats.avgLatencyMs = Math.round(
      (this.stats.avgLatencyMs * (totalCycles - 1) + cycleStats.avgLatencyMs) /
      totalCycles
    );

    this.stats.lastCycle = cycleStats;
  }

  /**
   * Log cycle summary.
   */
  private logCycleSummary(cycleStats: CycleStats): void {
    const { cycle, readingsGenerated, readingsSent, errors, avgLatencyMs, durationMs } =
      cycleStats;

    const successRate =
      readingsGenerated > 0
        ? ((readingsSent / readingsGenerated) * 100).toFixed(1)
        : '0.0';

    logger.info(
      {
        cycle,
        generated: readingsGenerated,
        sent: readingsSent,
        errors,
        latency: `${avgLatencyMs}ms`,
        duration: `${durationMs}ms`,
        successRate: `${successRate}%`,
      },
      '📊 Cycle complete'
    );

    // Log detailed summary every 10 cycles
    if (cycle % 10 === 0) {
      this.logDetailedSummary();
    }
  }

  /**
   * Log detailed cumulative summary.
   */
  private logDetailedSummary(): void {
    const uptimeSeconds = Math.floor((Date.now() - this.stats.startTime) / 1000);
    const readingsPerSecond =
      uptimeSeconds > 0 ? Math.round(this.stats.totalSent / uptimeSeconds) : 0;

    logger.info(
      {
        summary: {
          totalCycles: this.stats.totalCycles,
          totalReadings: this.stats.totalReadings,
          totalSent: this.stats.totalSent,
          totalErrors: this.stats.totalErrors,
          avgLatency: `${this.stats.avgLatencyMs}ms`,
          uptime: `${uptimeSeconds}s`,
          throughput: `${readingsPerSecond} readings/s`,
          successRate: `${((this.stats.totalSent / this.stats.totalReadings) * 100).toFixed(1)}%`,
        },
      },
      '📈 Cumulative Statistics'
    );
  }

  /**
   * Stop the simulator.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info('Stopping simulator');
    this.running = false;

    // Close sender connection
    await this.sender.close();

    // Log final summary
    this.logDetailedSummary();

    logger.info('✅ Simulator stopped gracefully');
  }

  /**
   * Set up graceful shutdown handlers.
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    // Print banner
    printBanner();

    // Load configuration
    let config = loadConfig();

    // Parse CLI arguments
    config = parseCliArgs(config);

    // Create and start simulator
    const simulator = new TelemetrySimulator(config);
    await simulator.initialize();
    await simulator.start();
  } catch (error) {
    logger.error({ error }, 'Fatal error');
    process.exit(1);
  }
}

/**
 * Print application banner.
 */
function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🔌  Smart Energy Grid Telemetry Simulator v1.0.0         ║
║                                                               ║
║     Simulating real-time power consumption from thousands    ║
║     of virtual smart meters across multiple regions.         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

// Run the simulator
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
