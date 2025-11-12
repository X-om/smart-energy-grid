import { initialize, startProcessing, shutdown } from './lifecycle/processLifecycle';
import { createLogger } from './utils/logger';
import { config } from './config/env';

const logger = createLogger('main');

const main = async (): Promise<void> => {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ⚡  Smart Energy Grid - Stream Processor v1.0.0          ║
║                                                               ║
║     Real-time aggregation and anomaly detection engine       ║
║     Processes telemetry streams from thousands of meters     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    await initialize();
    await startProcessing();

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled promise rejection');
      shutdown('unhandledRejection');
    });

    logger.info({
      kafka: config.kafka,
      flushInterval1m: `${config.flushInterval1m}ms`,
      flushInterval15m: `${config.flushInterval15m}ms`,
    }, '🚀 Stream Processor running');
  } catch (error) {
    logger.error({ error }, 'Failed to start Stream Processor');
    process.exit(1);
  }
};

main();
