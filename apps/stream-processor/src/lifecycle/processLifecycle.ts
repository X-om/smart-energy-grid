import http from 'http';
import { TimescaleDBService } from '../db/timescale.js';
import { KafkaConsumerService } from '../kafka/consumer.js';
import { KafkaProducerService } from '../kafka/producer.js';
import { AggregatorService } from '../services/aggregator.js';
import { AnomalyDetectorService } from '../services/anomalyDetector.js';
import { handleReading } from '../helpers/processorsHelper.js';
import { flush1mAggregates, flush15mAggregates } from '../controllers/flushController.js';
import { startMetricsServer } from '../controllers/metricsController.js';
import { createLogger } from '../utils/logger.js';
import { kafkaConsumerConnected, kafkaProducerConnected, timescaledbConnected } from '../metrics/metrics.js';
import { config } from '../config/env.js';

const logger = createLogger('lifecycle');

let metricsServer: http.Server;
let flush1mInterval: NodeJS.Timeout;
let flush15mInterval: NodeJS.Timeout;
let lagCheckInterval: NodeJS.Timeout;

export const initialize = async (): Promise<void> => {
  logger.info('Initializing Stream Processor...');

  const db = TimescaleDBService.getInstance(config.postgres.url);
  await db.connect();
  timescaledbConnected.set(1);

  const kafkaConsumer = KafkaConsumerService.getInstance({
    brokers: config.kafka.brokers, clientId: config.kafka.clientId,
    groupId: config.kafka.groupId, topic: config.kafka.topicInput
  });
  await kafkaConsumer.connect();
  kafkaConsumerConnected.set(1);

  const kafkaProducer = KafkaProducerService.getInstance({ brokers: config.kafka.brokers, clientId: config.kafka.clientId });
  await kafkaProducer.connect();
  kafkaProducerConnected.set(1);

  AggregatorService.getInstance();
  AnomalyDetectorService.getInstance(db, { spikeThreshold: 1.0, dropThreshold: 0.5, minSampleSize: 5 });

  logger.info('All services initialized successfully');
};

export const startProcessing = async (): Promise<void> => {
  const kafkaConsumer = KafkaConsumerService.getInstance();
  kafkaConsumer.onMessage(handleReading);
  await kafkaConsumer.startConsuming();

  flush1mInterval = setInterval(flush1mAggregates, config.flushInterval1m);
  flush15mInterval = setInterval(flush15mAggregates, config.flushInterval15m);

  lagCheckInterval = setInterval(async () => {
    const lag = await kafkaConsumer.getLag();
    logger.debug({ lag }, 'Consumer lag check');
  }, 30000);

  metricsServer = startMetricsServer();
  logger.info('Started processing telemetry stream');
};

export const shutdown = async (signal: string): Promise<void> => {
  try {
    logger.info({ signal }, 'Shutdown signal received');

    if (flush1mInterval) clearInterval(flush1mInterval);
    if (flush15mInterval) clearInterval(flush15mInterval);
    if (lagCheckInterval) clearInterval(lagCheckInterval);

    await flush1mAggregates();
    await flush15mAggregates();

    if (metricsServer) {
      await new Promise<void>((resolve) => metricsServer.close(() => resolve()));
      logger.info('Metrics server closed');
    }

    const kafkaConsumer = KafkaConsumerService.getInstance();
    await kafkaConsumer.disconnect();
    logger.info('Kafka consumer disconnected');

    const kafkaProducer = KafkaProducerService.getInstance();
    await kafkaProducer.disconnect();
    logger.info('Kafka producer disconnected');

    const db = TimescaleDBService.getInstance();
    await db.disconnect();
    logger.info('TimescaleDB disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};
