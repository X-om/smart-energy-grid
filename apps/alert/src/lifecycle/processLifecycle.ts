import express, { Application } from 'express';
import { Server } from 'http';
import { Config } from '../config/env';
import { PostgresService } from '../services/postgresService';
import { RedisCacheService } from '../services/redisCacheService';
import { KafkaConsumerService } from '../services/kafkaConsumerService';
import { KafkaProducerService } from '../services/kafkaProducerService';
import { AlertManagerService } from '../services/alertManagerService';
import { AggregateHelper } from '../helpers/aggregateHelper';
import { AlertHelper } from '../helpers/alertHelper';
import { getHealth, getMetrics } from '../controllers/healthController';
import { operatorRouter } from '../routes/operatorRouter';
import { userRouter } from '../routes/userRouter';
import { createLogger } from '../utils/logger';

const logger = createLogger('lifecycle');

let server: Server;

export const initialize = async (): Promise<void> => {
  logger.info('Initializing Alert Service...');

  const db = PostgresService.getInstance(Config.postgres.connectionString);
  await db.connect();
  logger.info('PostgreSQL connected');

  const cache = RedisCacheService.getInstance(Config.redis.url);
  await cache.connect();
  logger.info('Redis connected');

  const kafkaConsumer = KafkaConsumerService.getInstance({
    brokers: Config.kafka.brokers,
    clientId: Config.kafka.clientId,
    groupId: Config.kafka.groupId,
    topics: [Config.kafka.topicAggregates, Config.kafka.topicAlerts]
  });
  await kafkaConsumer.connect();
  logger.info('Kafka consumer connected');

  const kafkaProducer = KafkaProducerService.getInstance({
    brokers: Config.kafka.brokers,
    clientId: Config.kafka.clientId
  });
  await kafkaProducer.connect();
  logger.info('Kafka producer connected');

  AlertManagerService.getInstance(
    db,
    cache,
    kafkaProducer,
    Config.kafka.topicAlertsProcessed,
    Config.kafka.topicAlertStatusUpdates,
    Config.alertThresholds.deduplicationMinutes * 60
  );
  logger.info('Alert Manager initialized');

  logger.info('All services initialized successfully');
};

export const startProcessing = async (): Promise<void> => {
  const kafkaConsumer = KafkaConsumerService.getInstance();
  const cache = RedisCacheService.getInstance();
  const alertManager = AlertManagerService.getInstance();

  const aggregateHelper = AggregateHelper.getInstance(cache, alertManager);
  const alertHelper = AlertHelper.getInstance(alertManager);

  kafkaConsumer.setMessageHandler(async (topic: string, message: any) => {
    if (topic === 'aggregated-data') {
      await aggregateHelper.processRegionalAggregate(message);
    } else if (topic === 'anomaly-detected') {
      await alertHelper.processAnomalyAlert(message);
    }
  });

  await kafkaConsumer.startConsuming();
  logger.info('Started consuming from Kafka topics');
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
  app.use('/user', userRouter);
  app.get('/metrics', getMetrics);
  app.get('/health', getHealth);

  return app;
};

export const startServer = async (): Promise<void> => {
  const app = createApp();
  return new Promise<void>((resolve) => {
    server = app.listen(Config.server.port, () => {
      logger.info({ port: Config.server.port }, 'API server started');
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
