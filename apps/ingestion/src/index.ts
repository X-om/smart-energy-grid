import express, { Application } from 'express';
import { Server } from 'http';
import { KafkaProducerService } from './services/kafkaProducer';
import { DeduplicationService } from './services/redisDedupe';
import { requestAndMetricsLogger } from './middlewares/requestLogger';
import { globalErrorHandler, notFoundHandler } from './middlewares/errorHandler';
import { healthCheckController } from './controllers/healthController';
import { ingestionMetricsController } from './controllers/metricsController';
import { telemetryRouter } from './routes/telemetryRouter';
import { createLogger } from './utils/logger';
import { config } from './config/env';

const logger = createLogger('main');

let server: Server;

const initialize = async (): Promise<void> => {
  logger.info('Initializing Ingestion Service...');
  const kafkaProducer = KafkaProducerService.getInstance({ brokers: config.kafka.brokers, clientId: config.kafka.clientId, topic: config.kafka.topic });
  const dedupeService = DeduplicationService.getInstance(config.redis.url, config.redis.dedupTtl);

  logger.info({ brokers: config.kafka.brokers }, 'Connecting to Kafka...');
  await kafkaProducer.connect();

  logger.info({ url: config.redis.url }, 'Connecting to Redis...');
  await dedupeService.connect();

  logger.info('All services initialized successfully');
};

const createApp = (): Application => {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json({ limit: '10mb' }));
  app.use(requestAndMetricsLogger);

  app.get('/health', healthCheckController);
  app.get('/metrics', ingestionMetricsController);
  app.use('/telemetry', telemetryRouter);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};

const startServer = async (): Promise<void> => {
  const app = createApp();

  return new Promise<void>((resolve) => {
    server = app.listen(config.port, () => {
      logger.info({ port: config.port, kafka: { brokers: config.kafka.brokers, topic: config.kafka.topic }, redis: config.redis.url, }, '🚀 Ingestion Service started');
      resolve();
    });
  });
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutdown signal received');
  try {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((err: Error | undefined) => (err) ? reject(err) : resolve()));
      logger.info('HTTP server closed');
    }

    const kafkaProducer = KafkaProducerService.getInstance();
    await kafkaProducer.disconnect();
    logger.info('Kafka producer disconnected');

    const dedupeService = DeduplicationService.getInstance();
    await dedupeService.disconnect();
    logger.info('Redis client disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  try {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     📥  Smart Energy Grid - Ingestion Service v1.0.0         ║
║                                                               ║
║     High-throughput telemetry data ingestion gateway         ║
║     Validates, deduplicates, and publishes to Kafka          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    await initialize();
    await startServer();

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

  } catch (error) {
    logger.error({ error }, 'Failed to start Ingestion Service');
    process.exit(1);
  }
};

main();
