import { initialize, startProcessing, startServer, shutdown } from './lifecycle/processLifecycle.js';
import { createLogger } from './utils/logger.js';
import { Config } from './config/env.js';

const logger = createLogger('main');

const main = async (): Promise<void> => {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🚨  Smart Energy Grid - Alert Service v1.0.0            ║
║                                                               ║
║     Real-time alert generation and management system         ║
║     Monitors grid health, anomalies, and regional load       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    await initialize();
    await startServer();
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

    logger.info({ kafka: Config.kafka, port: Config.server.port }, '🚀 Alert Service running');
  } catch (error) {
    logger.error({ error }, 'Failed to start Alert Service');
    process.exit(1);
  }
};

main();
