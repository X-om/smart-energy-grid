/**
 * Ingestion Service - Main Entry Point
 * 
 * Initializes and starts the HTTP server with:
 * - Kafka producer connection
 * - Redis deduplication service
 * - Express HTTP server
 * - Graceful shutdown handling
 */

import dotenv from 'dotenv';
import { createServer } from './server.js';
import { KafkaProducerService } from './kafka/producer.js';
import { DeduplicationService } from './redis/dedupe.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

// Configuration from environment
const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    topic: process.env.KAFKA_TOPIC || 'raw_readings',
    clientId: process.env.KAFKA_CLIENT_ID || 'ingestion-service',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    dedupTtl: parseInt(process.env.DEDUP_TTL || '60', 10),
  },
};

// Service instances
let kafkaProducer: KafkaProducerService;
let dedupeService: DeduplicationService;
let server: import('http').Server;

/**
 * Initialize services
 */
async function initialize() {
  logger.info('Initializing Ingestion Service...');

  // Create Kafka producer
  kafkaProducer = new KafkaProducerService({
    brokers: config.kafka.brokers,
    clientId: config.kafka.clientId,
    topic: config.kafka.topic,
  });

  // Create Redis deduplication service
  dedupeService = new DeduplicationService(
    config.redis.url,
    config.redis.dedupTtl
  );

  // Connect to Kafka
  logger.info({ brokers: config.kafka.brokers }, 'Connecting to Kafka...');
  await kafkaProducer.connect();

  // Connect to Redis
  logger.info({ url: config.redis.url }, 'Connecting to Redis...');
  await dedupeService.connect();

  logger.info('All services initialized successfully');
}

/**
 * Start HTTP server
 */
async function startServer() {
  const app = createServer({
    kafkaProducer,
    dedupeService,
  });

  return new Promise<void>((resolve) => {
    server = app.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          kafka: {
            brokers: config.kafka.brokers,
            topic: config.kafka.topic,
          },
          redis: config.redis.url,
        },
        '🚀 Ingestion Service started'
      );
      resolve();
    });
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed');
    }

    // Disconnect from Kafka
    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      logger.info('Kafka producer disconnected');
    }

    // Disconnect from Redis
    if (dedupeService) {
      await dedupeService.disconnect();
      logger.info('Redis client disconnected');
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
║     📥  Smart Energy Grid - Ingestion Service v1.0.0         ║
║                                                               ║
║     High-throughput telemetry data ingestion gateway         ║
║     Validates, deduplicates, and publishes to Kafka          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    // Initialize services
    await initialize();

    // Start HTTP server
    await startServer();

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
  } catch (error) {
    logger.error({ error }, 'Failed to start Ingestion Service');
    process.exit(1);
  }
}

// Start the service
main();
