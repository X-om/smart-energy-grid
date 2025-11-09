import express, { Application } from 'express';
import { Server } from 'http';
import { createLogger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { PostgresService } from '../services/postgresService.js';
import { RedisCacheService } from '../services/redisCacheService.js';
import { KafkaConsumerService } from '../services/kafkaConsumerService.js';
import { KafkaProducerService } from '../services/kafkaProducerService.js';
import { TariffCalculatorService } from '../services/tariffCalculatorService.js';
import { OverrideHandlerService } from '../services/overrideHandlerService.js';
import { handleAggregate } from '../helpers/aggregateHelper.js';
import { healthCheckController } from '../controllers/healthController.js';
import { tariffMetricsController } from '../controllers/metricsController.js';
import { operatorRouter } from '../routes/operatorRouter.js';
import { postgresConnected, redisConnected, kafkaConsumerConnected, kafkaProducerConnected, updateAllPrices } from '../metrics/metrics.js';

const logger = createLogger('lifecycle');

let server: Server;

export const initialize = async (): Promise<void> => {
  logger.info('Initializing Tariff Service...');

  const db = PostgresService.getInstance(config.postgres.url);
  await db.connect();
  postgresConnected.set(1);

  const cache = RedisCacheService.getInstance(config.redis.url);
  await cache.connect();
  redisConnected.set(1);

  const tariffMap = await db.getAllCurrentTariffs();
  if (tariffMap.size > 0) await cache.preloadTariffs(tariffMap);

  const kafkaConsumer = KafkaConsumerService.getInstance({
    brokers: config.kafka.brokers, clientId: config.kafka.clientId,
    groupId: config.kafka.groupId, topic: config.kafka.topicInput,
  });
  await kafkaConsumer.connect();
  kafkaConsumerConnected.set(1);

  const kafkaProducer = KafkaProducerService.getInstance({ brokers: config.kafka.brokers, clientId: config.kafka.clientId, });
  await kafkaProducer.connect();
  kafkaProducerConnected.set(1);

  const calculator = TariffCalculatorService.getInstance({
    basePrice: config.basePrice, minChangeThreshold: config.thresholds.minChangeThreshold,
    criticalLoadThreshold: config.thresholds.criticalLoadThreshold, highLoadThreshold: config.thresholds.highLoadThreshold,
    normalLoadThreshold: config.thresholds.normalLoadThreshold, lowLoadThreshold: config.thresholds.lowLoadThreshold,
  });

  for (const [region, price] of tariffMap.entries())
    calculator.setLastPrice(region, price);

  updateAllPrices(tariffMap);
  OverrideHandlerService.getInstance(db, cache, kafkaProducer, config.kafka.topicOutput);

  logger.info('All services initialized successfully');
};

export const startProcessing = async (): Promise<void> => {
  const kafkaConsumer = KafkaConsumerService.getInstance();
  kafkaConsumer.onAggregate(handleAggregate);
  await kafkaConsumer.startConsuming();
  logger.info('Started consuming from Kafka');
};

export const createApp = (): Application => {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug({ method: req.method, path: req.path, status: res.statusCode, duration }, 'API request');
    });
    next();
  });

  app.use('/operator', operatorRouter);
  app.get('/metrics', tariffMetricsController);
  app.get('/health', healthCheckController);

  return app;
};

export const startServer = async (): Promise<void> => {
  const app = createApp();
  return new Promise<void>((resolve) => {
    server = app.listen(config.port, () => {
      logger.info({ port: config.port }, 'API server started');
      resolve();
    });
  });
};

export const shutdown = async (signal: string): Promise<void> => {
  try {
    logger.info({ signal }, 'Shutdown signal received');

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      logger.info('API server closed');
    }

    const kafkaConsumer = KafkaConsumerService.getInstance();
    await kafkaConsumer.disconnect();
    logger.info('Kafka consumer disconnected');

    const kafkaProducer = KafkaProducerService.getInstance();
    await kafkaProducer.disconnect();
    logger.info('Kafka producer disconnected');

    const cache = RedisCacheService.getInstance();
    await cache.disconnect();
    logger.info('Redis disconnected');

    const db = PostgresService.getInstance();
    await db.disconnect();
    logger.info('PostgreSQL disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};
