import { config as loadEnv } from 'dotenv';
import { SimulatorConfig } from './types.js';
import { validateMode, validateTarget, parseArray, parseBoolean, parseInt, parseFloat } from './utils/configHelpers.js';
loadEnv();

export const loadConfig = (): SimulatorConfig => {
  const config: SimulatorConfig = {
    meters: parseInt(process.env.METERS, 5000),
    interval: parseInt(process.env.INTERVAL, 10),
    mode: validateMode(process.env.MODE || 'normal'),
    target: validateTarget(process.env.TARGET || 'http'),
    ingestionUrl: process.env.INGESTION_URL || 'http://localhost:3001/telemetry/batch',
    kafkaBrokers: parseArray(process.env.KAFKA_BROKERS, ['localhost:9092']),
    kafkaTopic: process.env.KAFKA_TOPIC || 'raw_readings',
    kafkaClientId: process.env.KAFKA_CLIENT_ID || 'segs-simulator',
    regions: parseArray(process.env.REGIONS, ['Pune-West', 'Mumbai-North', 'Delhi-South', 'Bangalore-East']),
    duplicateRate: parseFloat(process.env.DUPLICATE_RATE, 0.01),
    batchSize: parseInt(process.env.BATCH_SIZE, 500),
    concurrencyLimit: parseInt(process.env.CONCURRENCY_LIMIT, 10),
    iterations: parseInt(process.env.ITERATIONS, 0),
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, false),
    metricsPort: parseInt(process.env.METRICS_PORT, 7000),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS, 3),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS, 1000),
    minVoltage: parseInt(process.env.MIN_VOLTAGE, 220),
    maxVoltage: parseInt(process.env.MAX_VOLTAGE, 240),
    baseLoadMinKw: parseFloat(process.env.BASE_LOAD_MIN_KW, 1.0),
    baseLoadMaxKw: parseFloat(process.env.BASE_LOAD_MAX_KW, 8.0),
    availableRegions: parseArray(process.env.AVAILABLE_REGIONS, ['Pune-West', 'Mumbai-North', 'Delhi-South', 'Bangalore-East']),
  };

  if (config.meters <= 0) throw new Error('METERS must be greater than 0');
  if (config.interval <= 0) throw new Error('INTERVAL must be greater than 0');
  if (config.duplicateRate < 0 || config.duplicateRate > 1) throw new Error('DUPLICATE_RATE must be between 0 and 1');
  if (config.batchSize <= 0) throw new Error('BATCH_SIZE must be greater than 0');
  if (config.concurrencyLimit <= 0) throw new Error('CONCURRENCY_LIMIT must be greater than 0');
  if (config.regions.length === 0) throw new Error('REGIONS must contain at least one region');

  return config;
}

export const parseCliArgs = (config: SimulatorConfig): SimulatorConfig => {
  const args = process.argv.slice(2);
  const overrides: Partial<SimulatorConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--meters': if (nextArg) overrides.meters = Number.parseInt(nextArg, 10); i++; break;
      case '--interval': if (nextArg) overrides.interval = Number.parseInt(nextArg, 10); i++; break;
      case '--mode': if (nextArg) overrides.mode = validateMode(nextArg); i++; break;
      case '--target': if (nextArg) overrides.target = validateTarget(nextArg); i++; break;
      case '--iterations': if (nextArg) overrides.iterations = Number.parseInt(nextArg, 10); i++; break;
      case '--help': printHelp(); process.exit(0); break;
    }
  }
  return { ...config, ...overrides };
}



const printHelp = (): void => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Smart Energy Grid Telemetry Simulator v1.0.0           ║
╚════════════════════════════════════════════════════════════════╝

Usage: pnpm dev [options]

Options:
  --meters <number>       Number of virtual meters to simulate (default: 5000)
  --interval <seconds>    Interval between readings (default: 10)
  --mode <mode>          Simulation mode: normal | peak | outage (default: normal)
  --target <target>      Target destination: http | kafka (default: http)
  --iterations <number>  Number of cycles to run (0 = infinite, default: 0)
  --help                 Show this help message

Environment Variables:
  See .env.example for all available configuration options.

Examples:
  pnpm dev
  pnpm dev -- --meters 10000 --interval 5 --mode peak
  pnpm dev -- --target kafka --iterations 100

Documentation:
  See README.md for detailed information.
  `);
}
