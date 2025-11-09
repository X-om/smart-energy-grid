import { AggregatorService } from '../services/aggregator.js';
import { TimescaleDBService } from '../db/timescale.js';
import { KafkaProducerService } from '../kafka/producer.js';
import { createLogger } from '../utils/logger.js';
import { streamAggregatesWrittenTotal, streamAggregatesPublishedTotal, streamAggregationFlushDuration, dbWriteLatency } from '../metrics/metrics.js';
import { config } from '../config/env.js';

const logger = createLogger('flush-controller');

export const flush1mAggregates = async (): Promise<void> => {
  try {
    const startTime = Date.now();
    const aggregator = AggregatorService.getInstance();
    const aggregates = aggregator.getReadyAggregates1m();

    if (aggregates.length === 0) return logger.debug('No 1m aggregates ready to flush');

    logger.info({ count: aggregates.length }, 'Flushing 1m aggregates');

    const db = TimescaleDBService.getInstance();
    const dbStart = Date.now();

    await db.upsertAggregates1m(aggregates);
    const dbDuration = Date.now() - dbStart;

    dbWriteLatency.observe({ operation: 'upsert_1m' }, dbDuration);
    streamAggregatesWrittenTotal.inc({ window_type: '1m' }, aggregates.length);

    const kafkaProducer = KafkaProducerService.getInstance();
    const published = await kafkaProducer.publishAggregates1m(aggregates, config.kafka.topicAgg1m);

    streamAggregatesPublishedTotal.inc({ window_type: '1m' }, published);

    // Publish regional aggregates
    const regionalAggregates = aggregator.getRegionalAggregates1m();
    if (regionalAggregates.length > 0) {
      const regionalPublished = await kafkaProducer.publishRegionalAggregates1m(regionalAggregates, config.kafka.topicRegional1m);
      streamAggregatesPublishedTotal.inc({ window_type: '1m_regional' }, regionalPublished);
      logger.debug({ count: regionalPublished }, 'Published regional 1m aggregates');
    }

    aggregator.clearFlushedWindows1m();

    const duration = Date.now() - startTime;
    streamAggregationFlushDuration.observe({ window_type: '1m' }, duration);

    logger.info({ count: aggregates.length, regionalCount: regionalAggregates.length, dbDuration, duration }, 'Flushed 1m aggregates');
  } catch (error) {
    logger.error({ error }, 'Error flushing 1m aggregates');
  }
};

export const flush15mAggregates = async (): Promise<void> => {
  try {
    const startTime = Date.now();
    const aggregator = AggregatorService.getInstance();
    const aggregates = aggregator.getReadyAggregates15m();

    if (aggregates.length === 0) return logger.debug('No 15m aggregates ready to flush');
    logger.info({ count: aggregates.length }, 'Flushing 15m aggregates');

    const db = TimescaleDBService.getInstance();
    const dbStart = Date.now();
    await db.upsertAggregates15m(aggregates);
    const dbDuration = Date.now() - dbStart;

    dbWriteLatency.observe({ operation: 'upsert_15m' }, dbDuration);
    streamAggregatesWrittenTotal.inc({ window_type: '15m' }, aggregates.length);

    const kafkaProducer = KafkaProducerService.getInstance();
    const published = await kafkaProducer.publishAggregates15m(aggregates, config.kafka.topicAgg15m);

    streamAggregatesPublishedTotal.inc({ window_type: '15m' }, published);
    aggregator.clearFlushedWindows15m();

    const duration = Date.now() - startTime;
    streamAggregationFlushDuration.observe({ window_type: '15m' }, duration);

    logger.info({ count: aggregates.length, dbDuration, duration }, 'Flushed 15m aggregates');
  } catch (error) {
    logger.error({ error }, 'Error flushing 15m aggregates');
  }
};
