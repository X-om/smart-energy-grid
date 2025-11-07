/**
 * Stream Processor - Main Entry Point
 * 
 * Consumes raw telemetry from Kafka, computes aggregations,
 * detects anomalies, and stores results in TimescaleDB.
 */

import dotenv from 'dotenv';
import http from 'http';
import type { TelemetryReading } from '@segs/shared-types';
import { TimescaleDBService } from './db/timescale.js';
import { KafkaConsumerService } from './kafka/consumer.js';
import { KafkaProducerService } from './kafka/producer.js';
import { AggregatorService } from './services/aggregator.js';
import { AnomalyDetectorService } from './services/anomalyDetector.js';
import { calculateLagSeconds } from './utils/time.js';
import logger from './utils/logger.js';
import {
  register,
  streamMessagesTotal,
  streamAggregatesWrittenTotal,
  streamAggregatesPublishedTotal,
  streamAnomaliesDetectedTotal,
  streamAlertsPublishedTotal,
  streamAggregationFlushDuration,
  dbWriteLatency,
  dbConnectionPoolSize,
  streamLagSeconds,
  kafkaConsumerConnected,
  kafkaProducerConnected,
  timescaledbConnected,
  streamWindowedReadingsGauge,
  streamWindowBucketsGauge,
  updateUptime,
} from './metrics/metrics.js';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'stream-processor',
    groupId: process.env.KAFKA_GROUP_ID || 'stream-processor-group',
    topicInput: process.env.KAFKA_TOPIC_INPUT || 'raw_readings',
    topicAgg1m: process.env.KAFKA_TOPIC_AGG_1M || 'aggregates_1m',
    topicAgg15m: process.env.KAFKA_TOPIC_AGG_15M || 'aggregates_15m',
    topicAlerts: process.env.KAFKA_TOPIC_ALERTS || 'alerts',
  },
  postgres: {
    url: process.env.POSTGRES_URL || 'postgres://postgres:password@localhost:5432/segs',
  },
  flushInterval1m: parseInt(process.env.FLUSH_INTERVAL_1M || '60000', 10), // 60 seconds
  flushInterval15m: parseInt(process.env.FLUSH_INTERVAL_15M || '900000', 10), // 15 minutes
};

// Service instances
let db: TimescaleDBService;
let kafkaConsumer: KafkaConsumerService;
let kafkaProducer: KafkaProducerService;
let aggregator: AggregatorService;
let anomalyDetector: AnomalyDetectorService;
let metricsServer: http.Server;
let flush1mInterval: NodeJS.Timeout;
let flush15mInterval: NodeJS.Timeout;
let lagCheckInterval: NodeJS.Timeout;

/**
 * Initialize all services
 */
async function initialize() {
  logger.info('Initializing Stream Processor...');

  // Create TimescaleDB connection
  db = new TimescaleDBService(config.postgres.url);
  await db.connect();
  timescaledbConnected.set(1);

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

  // Create aggregator service
  aggregator = new AggregatorService();

  // Create anomaly detector
  anomalyDetector = new AnomalyDetectorService(db, {
    spikeThreshold: 1.0, // 100% increase
    dropThreshold: 0.5, // 50% decrease
    minSampleSize: 5, // Require at least 5 samples
  });

  logger.info('All services initialized successfully');
}

/**
 * Handle incoming telemetry reading
 */
async function handleReading(reading: TelemetryReading): Promise<void> {
  try {
    const startTime = Date.now();

    // Increment messages counter
    streamMessagesTotal.inc({ topic: config.kafka.topicInput });

    // Update lag metric
    const lag = calculateLagSeconds(reading.timestamp);
    streamLagSeconds.set(lag);

    // Process reading through aggregator
    aggregator.processReading(reading);

    // Check for anomalies
    const alert = await anomalyDetector.checkReading(reading);
    if (alert) {
      // Publish alert
      const published = await kafkaProducer.publishAlert(alert, config.kafka.topicAlerts);
      if (published) {
        streamAnomaliesDetectedTotal.inc({
          type: alert.type,
          severity: alert.severity,
        });
        streamAlertsPublishedTotal.inc();
      }
    }

    // Record processing time
    const duration = Date.now() - startTime;
    logger.debug(
      {
        meterId: reading.meterId,
        powerKw: reading.powerKw,
        duration,
      },
      'Reading processed'
    );
  } catch (error) {
    logger.error({ error, reading }, 'Error handling reading');
  }
}

/**
 * Flush 1-minute aggregates
 */
async function flush1mAggregates() {
  const startTime = Date.now();

  try {
    // Get ready aggregates
    const aggregates = aggregator.getReadyAggregates1m();

    if (aggregates.length === 0) {
      logger.debug('No 1m aggregates ready to flush');
      return;
    }

    logger.info({ count: aggregates.length }, 'Flushing 1m aggregates');

    // Write to TimescaleDB
    const dbStart = Date.now();
    await db.upsertAggregates1m(aggregates);
    const dbDuration = Date.now() - dbStart;
    dbWriteLatency.observe({ operation: 'upsert_1m' }, dbDuration);
    streamAggregatesWrittenTotal.inc({ window_type: '1m' }, aggregates.length);

    // Publish to Kafka
    const published = await kafkaProducer.publishAggregates1m(
      aggregates,
      config.kafka.topicAgg1m
    );
    streamAggregatesPublishedTotal.inc({ window_type: '1m' }, published);

    // Clear flushed windows
    aggregator.clearFlushedWindows1m();

    const duration = Date.now() - startTime;
    streamAggregationFlushDuration.observe({ window_type: '1m' }, duration);

    logger.info(
      {
        count: aggregates.length,
        dbDuration,
        duration,
      },
      'Flushed 1m aggregates'
    );
  } catch (error) {
    logger.error({ error }, 'Error flushing 1m aggregates');
  }
}

/**
 * Flush 15-minute aggregates
 */
async function flush15mAggregates() {
  const startTime = Date.now();

  try {
    // Get ready aggregates
    const aggregates = aggregator.getReadyAggregates15m();

    if (aggregates.length === 0) {
      logger.debug('No 15m aggregates ready to flush');
      return;
    }

    logger.info({ count: aggregates.length }, 'Flushing 15m aggregates');

    // Write to TimescaleDB
    const dbStart = Date.now();
    await db.upsertAggregates15m(aggregates);
    const dbDuration = Date.now() - dbStart;
    dbWriteLatency.observe({ operation: 'upsert_15m' }, dbDuration);
    streamAggregatesWrittenTotal.inc({ window_type: '15m' }, aggregates.length);

    // Publish to Kafka
    const published = await kafkaProducer.publishAggregates15m(
      aggregates,
      config.kafka.topicAgg15m
    );
    streamAggregatesPublishedTotal.inc({ window_type: '15m' }, published);

    // Clear flushed windows
    aggregator.clearFlushedWindows15m();

    const duration = Date.now() - startTime;
    streamAggregationFlushDuration.observe({ window_type: '15m' }, duration);

    logger.info(
      {
        count: aggregates.length,
        dbDuration,
        duration,
      },
      'Flushed 15m aggregates'
    );
  } catch (error) {
    logger.error({ error }, 'Error flushing 15m aggregates');
  }
}

/**
 * Update metrics periodically
 */
function updateMetrics() {
  // Update aggregator stats
  const stats = aggregator.getStats();
  streamWindowBucketsGauge.set({ window_type: '1m' }, stats.windows1m.buckets);
  streamWindowBucketsGauge.set({ window_type: '15m' }, stats.windows15m.buckets);
  streamWindowedReadingsGauge.set({ window_type: '1m' }, stats.windows1m.readings);
  streamWindowedReadingsGauge.set({ window_type: '15m' }, stats.windows15m.readings);

  // Update DB connection pool stats
  const poolStats = db.getStats();
  dbConnectionPoolSize.set({ state: 'total' }, poolStats.total);
  dbConnectionPoolSize.set({ state: 'idle' }, poolStats.idle);
  dbConnectionPoolSize.set({ state: 'waiting' }, poolStats.waiting);

  // Update uptime
  updateUptime();
}

/**
 * Start metrics HTTP server
 */
function startMetricsServer() {
  metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        updateMetrics();
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error({ error }, 'Error generating metrics');
        res.statusCode = 500;
        res.end('Error generating metrics');
      }
    } else if (req.url === '/health') {
      const health = {
        status: 'ok',
        service: 'stream-processor',
        timestamp: new Date().toISOString(),
        connections: {
          kafka: kafkaConsumer.isConnected() && kafkaProducer.isConnected(),
          timescaledb: db.isConnected(),
        },
      };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(health));
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  metricsServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'Metrics server started');
  });
}

/**
 * Start processing
 */
async function startProcessing() {
  // Register message handler
  kafkaConsumer.onMessage(handleReading);

  // Start consuming
  await kafkaConsumer.startConsuming();

  // Start flush timers
  flush1mInterval = setInterval(flush1mAggregates, config.flushInterval1m);
  flush15mInterval = setInterval(flush15mAggregates, config.flushInterval15m);

  // Check consumer lag periodically
  lagCheckInterval = setInterval(async () => {
    const lag = await kafkaConsumer.getLag();
    logger.debug({ lag }, 'Consumer lag check');
  }, 30000); // Check every 30 seconds

  logger.info('Started processing telemetry stream');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');

  try {
    // Stop timers
    if (flush1mInterval) clearInterval(flush1mInterval);
    if (flush15mInterval) clearInterval(flush15mInterval);
    if (lagCheckInterval) clearInterval(lagCheckInterval);

    // Final flush
    await flush1mAggregates();
    await flush15mAggregates();

    // Close metrics server
    if (metricsServer) {
      await new Promise<void>((resolve) => {
        metricsServer.close(() => resolve());
      });
      logger.info('Metrics server closed');
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

    // Disconnect from TimescaleDB
    if (db) {
      await db.disconnect();
      logger.info('TimescaleDB disconnected');
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
║     ⚡  Smart Energy Grid - Stream Processor v1.0.0          ║
║                                                               ║
║     Real-time aggregation and anomaly detection engine       ║
║     Processes telemetry streams from thousands of meters     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    // Initialize services
    await initialize();

    // Start metrics server
    startMetricsServer();

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
        flushInterval1m: `${config.flushInterval1m}ms`,
        flushInterval15m: `${config.flushInterval15m}ms`,
      },
      '🚀 Stream Processor running'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start Stream Processor');
    process.exit(1);
  }
}

// Start the service
main();
