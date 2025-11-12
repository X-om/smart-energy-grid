import { createServer } from 'http';
import { initialize, startProcessing, createApp, startServer, shutdown } from './lifecycle/processLifecycle';
import { createLogger } from './utils/logger';
import { Config } from './config/env';

const logger = createLogger('main');
const main = async (): Promise<void> => {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     📡  Smart Energy Grid - Notification Service v1.0.0     ║
║                                                               ║
║     Real-time WebSocket notification broadcasting            ║
║     Delivers alerts and tariff updates to clients            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    await initialize();
    const app = createApp();
    const httpServer = createServer(app);

    await startServer(httpServer);
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

    logger.info({ kafka: Config.kafka, port: Config.server.port }, '🚀 Notification Service running');
  } catch (error) {
    logger.error({ error }, 'Failed to start Notification Service');
    process.exit(1);
  }
};

main();

