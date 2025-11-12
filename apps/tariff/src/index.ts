import { initialize, startProcessing, startServer, shutdown } from './lifecycle/processLifecycle';
import { createLogger } from './utils/logger';
import { config } from './config/env';

const logger = createLogger('main');

const main = async (): Promise<void> => {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     💰  Smart Energy Grid - Tariff Service v1.0.0           ║
║                                                               ║
║     Dynamic pricing engine for load-based tariff control     ║
║     Adjusts electricity prices based on regional demand      ║
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

    logger.info({ kafka: config.kafka, basePrice: config.basePrice, port: config.port }, '🚀 Tariff Service running');
  } catch (error) {
    logger.error({ error }, 'Failed to start Tariff Service');
    process.exit(1);
  }
};

main();

