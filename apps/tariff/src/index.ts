/**
 * Tariff Service - Main Entry Point
 * 
 * Dynamic pricing engine that adjusts electricity tariffs based on
 * regional load data and operator overrides.
 */

import dotenv from 'dotenv';
import express from 'express';
import { PostgresService } from './db/postgres.js';
import { RedisCacheService } from './cache/redisClient.js';
import { KafkaConsumerService } from './kafka/consumer.js';
import { KafkaProducerService } from './kafka/producer.js';
import { TariffCalculatorService } from './services/tariffCalculator.js';
import { OverrideHandlerService } from './services/overrideHandler.js';
import { createOperatorRouter } from './routes/operator.js';
import logger from './utils/logger.js';
import {
  register,
  tariffUpdatesTotal,
  kafkaMessagesConsumed,
  kafkaMessagesPublished,
  kafkaConsumerConnected,
  kafkaProducerConnected,
  postgresConnected,
  redisConnected,
  dbConnectionPoolSize,
  updateAllPrices,
  updateCurrentPrice,
  tariffCalcLatency,
  dbOperationLatency,
  updateUptime,
} from './metrics/metrics.js';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  basePrice: parseFloat(process.env.BASE_PRICE || '5.0'),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'tariff-service',
    groupId: process.env.KAFKA_GROUP_ID || 'tariff-group',
    topicInput: process.env.KAFKA_TOPIC_INPUT || 'aggregates_1m',
    topicOutput: process.env.KAFKA_TOPIC_OUTPUT || 'tariff_updates',
  },
  postgres: {
    url: process.env.POSTGRES_URL || 'postgres://segs_user:segs_password@localhost:5432/segs_db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  thresholds: {
    minChangeThreshold: 0.1, // ₹0.10 minimum change
    criticalLoadThreshold: 90,
    highLoadThreshold: 75,
    normalLoadThreshold: 50,
    lowLoadThreshold: 25,
  },
};

// Service instances
let db: PostgresService;
let cache: RedisCacheService;
let kafkaConsumer: KafkaConsumerService;
let kafkaProducer: KafkaProducerService;
let calculator: TariffCalculatorService;
let overrideHandler: OverrideHandlerService;
let app: express.Application;
let server: any;

/**
 * Initialize all services
 */
async function initialize() {
  logger.info('Initializing Tariff Service...');

  // Create PostgreSQL connection
  db = new PostgresService(config.postgres.url);
  await db.connect();
  postgresConnected.set(1);

  // Create Redis connection
  cache = new RedisCacheService(config.redis.url);
  await cache.connect();
  redisConnected.set(1);

  // Preload tariffs from database into Redis
  const tariffMap = await db.getAllCurrentTariffs();
  if (tariffMap.size > 0) {
    await cache.preloadTariffs(tariffMap);
  }

  // Create Kafka consumer
  kafkaConsumer = new KafkaConsumerService({
    brokers: config.kafka.brokers,
    clientId: config.kafka.clientId,
    groupId: config.kafka.groupId,
    topic: config.kafka.topicInput,
  });
  await kafkaConsumer.connect();
  kafkaConsumerConnected.set(1);

  // Create Kafka producer
  kafkaProducer = new KafkaProducerService({
    brokers: config.kafka.brokers,
    clientId: config.kafka.clientId,
  });
  await kafkaProducer.connect();
  kafkaProducerConnected.set(1);

  // Create tariff calculator
  calculator = new TariffCalculatorService({
    basePrice: config.basePrice,
    minChangeThreshold: config.thresholds.minChangeThreshold,
    criticalLoadThreshold: config.thresholds.criticalLoadThreshold,
    highLoadThreshold: config.thresholds.highLoadThreshold,
    normalLoadThreshold: config.thresholds.normalLoadThreshold,
    lowLoadThreshold: config.thresholds.lowLoadThreshold,
  });

  // Initialize calculator with current prices
  for (const [region, price] of tariffMap.entries()) {
    calculator.setLastPrice(region, price);
  }

  // Update metrics with current prices
  updateAllPrices(tariffMap);

  // Create override handler
  overrideHandler = new OverrideHandlerService(
    db,
    cache,
    kafkaProducer,
    config.kafka.topicOutput
  );

  logger.info('All services initialized successfully');
}

/**
 * Handle incoming aggregate from Kafka
 */
async function handleAggregate(aggregate: any): Promise<void> {
  const startTime = Date.now();

  try {
    // Increment consumed messages counter
    kafkaMessagesConsumed.inc({ topic: config.kafka.topicInput });

    // Calculate tariff
    const tariffUpdate = calculator.calculateTariff(aggregate);

    // Record calculation latency
    const calcDuration = Date.now() - startTime;
    tariffCalcLatency.observe({ region: aggregate.region }, calcDuration);

    if (!tariffUpdate) {
      // No significant change, skip update
      return;
    }

    // Save to database
    const dbStartTime = Date.now();
    await db.insertTariff({
      tariffId: tariffUpdate.tariffId,
      region: tariffUpdate.region,
      pricePerKwh: tariffUpdate.pricePerKwh,
      effectiveFrom: new Date(tariffUpdate.effectiveFrom),
      reason: tariffUpdate.reason,
      triggeredBy: tariffUpdate.triggeredBy,
    });
    const dbDuration = Date.now() - dbStartTime;
    dbOperationLatency.observe({ operation: 'insert' }, dbDuration);

    // Update cache
    await cache.setTariff(tariffUpdate.region, tariffUpdate.pricePerKwh);

    // Publish to Kafka
    await kafkaProducer.publishTariffUpdate(tariffUpdate, config.kafka.topicOutput);
    kafkaMessagesPublished.inc({ topic: config.kafka.topicOutput });

    // Update metrics
    tariffUpdatesTotal.inc({
      region: tariffUpdate.region,
      triggered_by: tariffUpdate.triggeredBy,
    });
    updateCurrentPrice(tariffUpdate.region, tariffUpdate.pricePerKwh);

    logger.info(
      {
        region: tariffUpdate.region,
        oldPrice: tariffUpdate.oldPrice,
        newPrice: tariffUpdate.pricePerKwh,
        reason: tariffUpdate.reason,
      },
      'Tariff update processed'
    );
  } catch (error) {
    logger.error({ error, aggregate }, 'Error processing aggregate');
  }
}

/**
 * Start processing
 */
async function startProcessing() {
  // Register aggregate handler
  kafkaConsumer.onAggregate(handleAggregate);

  // Start consuming
  await kafkaConsumer.startConsuming();

  logger.info('Started consuming from Kafka');
}

/**
 * Start Express API server
 */
function startApiServer() {
  app = express();

  // Middleware
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
        },
        'API request'
      );
    });
    next();
  });

  // Operator routes
  app.use('/operator', createOperatorRouter(overrideHandler, calculator));

  // Metrics endpoint
  app.get('/metrics', async (_req, res) => {
    try {
      // Update connection pool stats
      const poolStats = db.getStats();
      dbConnectionPoolSize.set({ state: 'total' }, poolStats.total);
      dbConnectionPoolSize.set({ state: 'idle' }, poolStats.idle);
      dbConnectionPoolSize.set({ state: 'waiting' }, poolStats.waiting);

      // Update uptime
      updateUptime();

      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error({ error }, 'Error generating metrics');
      res.status(500).end('Error generating metrics');
    }
  });

  // Health check
  app.get('/health', (_req, res) => {
    const health = {
      status: 'ok',
      service: 'tariff',
      timestamp: new Date().toISOString(),
      connections: {
        kafka: kafkaConsumer.isConnected() && kafkaProducer.isConnected(),
        postgres: db.isConnected(),
        redis: cache.isConnected(),
      },
    };
    res.json(health);
  });

  // Start server
  server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'API server started');
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');

  try {
    // Close HTTP server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      logger.info('API server closed');
    }

    // Disconnect from Kafka
    if (kafkaConsumer) {
      await kafkaConsumer.disconnect();
      logger.info('Kafka consumer disconnected');
    }
    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      logger.info('Kafka producer disconnected');
    }

    // Disconnect from Redis
    if (cache) {
      await cache.disconnect();
      logger.info('Redis disconnected');
    }

    // Disconnect from PostgreSQL
    if (db) {
      await db.disconnect();
      logger.info('PostgreSQL disconnected');
    }

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Display banner
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

    // Initialize services
    await initialize();

    // Start API server
    startApiServer();

    // Start processing
    await startProcessing();

    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled promise rejection');
      shutdown('unhandledRejection');
    });

    logger.info(
      {
        kafka: config.kafka,
        basePrice: config.basePrice,
        port: config.port,
      },
      '🚀 Tariff Service running'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start Tariff Service');
    process.exit(1);
  }
}

// Start the service
main();

