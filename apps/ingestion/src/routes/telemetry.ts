/**
 * Telemetry Routes
 * 
 * HTTP endpoints for receiving telemetry data:
 * - POST /telemetry → single reading
 * - POST /telemetry/batch → batch of readings
 */

import { Router, Request, Response } from 'express';

import { validateReading, validateBatch } from '../utils/validate.js';
import { createLogger } from '../utils/logger.js';
import { KafkaProducerService } from '../kafka/producer.js';
import { DeduplicationService } from '../redis/dedupe.js';
import { ingestionSuccessTotal, ingestionErrorsTotal, validationErrorsTotal, deduplicatedMessagesTotal, kafkaProduceLatency, kafkaMessagesPublished, kafkaPublishErrors, batchSizeHistogram, batchProcessingDuration, getBatchSizeRange, deduplicationCheckDuration, } from '../metrics/metrics.js';

const logger = createLogger('telemetry-routes');

export interface TelemetryRouterDeps {
  kafkaProducer: KafkaProducerService;
  dedupeService: DeduplicationService;
}

export function createTelemetryRouter(deps: TelemetryRouterDeps): Router {
  const router = Router();
  const { kafkaProducer, dedupeService } = deps;

  /**
   * POST /telemetry - Single reading
   */
  router.post('/telemetry', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Validate reading
      const validationResult = validateReading(req.body);
      if (!validationResult.success) {
        validationErrorsTotal.inc({ field: 'general' });
        ingestionErrorsTotal.inc({ error_type: 'validation' });
        logger.warn(
          { errors: validationResult.errors, ip: req.ip, },
          'Validation failed for single reading'
        );
        return res.status(400).json({ status: 'error', message: 'Validation failed', errors: validationResult.errors, });
      }

      const reading = validationResult.data;

      // Check for duplicate
      const dedupeStart = Date.now();
      const isNew = await dedupeService.checkAndMark(reading.readingId);
      deduplicationCheckDuration.observe(Date.now() - dedupeStart);

      if (!isNew) {
        deduplicatedMessagesTotal.inc();
        logger.debug(
          { readingId: reading.readingId },
          'Duplicate reading ignored'
        );
        return res.status(200).json({
          status: 'success',
          message: 'Reading already processed',
          readingId: reading.readingId,
          duplicate: true,
        });
      }

      // Publish to Kafka
      const publishStart = Date.now();
      const result = await kafkaProducer.publishReading(reading);
      const publishLatency = Date.now() - publishStart;

      kafkaProduceLatency.observe({ topic: kafkaProducer.getTopic() }, publishLatency);

      if (result.success) {
        kafkaMessagesPublished.inc({
          topic: kafkaProducer.getTopic(),
          partition: result.partition?.toString() || 'unknown',
        });
        ingestionSuccessTotal.inc({ region: reading.region });

        logger.info(
          {
            readingId: reading.readingId,
            meterId: reading.meterId,
            partition: result.partition,
            offset: result.offset,
            latency: Date.now() - startTime,
          },
          'Reading ingested successfully'
        );

        return res.status(200).json({
          status: 'success',
          readingId: reading.readingId,
          topic: kafkaProducer.getTopic(),
          partition: result.partition,
          offset: result.offset,
        });
      } else {
        kafkaPublishErrors.inc({
          topic: kafkaProducer.getTopic(),
          error_type: result.error?.name || 'unknown',
        });
        ingestionErrorsTotal.inc({ error_type: 'kafka_publish' });

        logger.error(
          {
            error: result.error,
            readingId: reading.readingId,
          },
          'Failed to publish reading to Kafka'
        );

        return res.status(500).json({
          status: 'error',
          message: 'Failed to publish reading',
          readingId: reading.readingId,
        });
      }
    } catch (error) {
      ingestionErrorsTotal.inc({ error_type: 'internal' });
      logger.error({ error, ip: req.ip }, 'Internal error processing reading');
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  /**
   * POST /telemetry/batch - Batch of readings
   */
  router.post('/telemetry/batch', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Validate batch structure
      const validationResult = validateBatch(req.body);
      if (!validationResult.success) {
        validationErrorsTotal.inc({ field: 'batch' });
        ingestionErrorsTotal.inc({ error_type: 'validation' });
        logger.warn(
          {
            errors: validationResult.errors,
            ip: req.ip,
          },
          'Validation failed for batch'
        );
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: validationResult.errors,
        });
      }

      const readings = validationResult.data;
      batchSizeHistogram.observe(readings.length);

      logger.info(
        {
          batchSize: readings.length,
          ip: req.ip,
        },
        'Processing telemetry batch'
      );

      // Deduplicate readings
      const dedupeStart = Date.now();
      const { unique, duplicates } = await dedupeService.filterDuplicates(readings);
      deduplicationCheckDuration.observe(Date.now() - dedupeStart);

      if (duplicates.length > 0) {
        deduplicatedMessagesTotal.inc(duplicates.length);
        logger.debug(
          {
            total: readings.length,
            unique: unique.length,
            duplicates: duplicates.length,
          },
          'Filtered duplicate readings'
        );
      }

      // If all readings are duplicates, return success
      if (unique.length === 0) {
        return res.status(200).json({
          status: 'success',
          accepted: 0,
          duplicates: duplicates.length,
          message: 'All readings were duplicates',
        });
      }

      // Publish unique readings to Kafka
      const publishStart = Date.now();
      const publishResult = await kafkaProducer.publishBatch(unique);
      const publishLatency = Date.now() - publishStart;

      kafkaProduceLatency.observe({ topic: kafkaProducer.getTopic() }, publishLatency);

      // Update metrics
      if (publishResult.successful > 0) {
        publishResult.partitions.forEach((partition) => {
          kafkaMessagesPublished.inc({
            topic: kafkaProducer.getTopic(),
            partition: partition.toString(),
          }, publishResult.successful / publishResult.partitions.size);
        });

        // Count by region
        const regionCounts = new Map<string, number>();
        unique.forEach((reading) => {
          regionCounts.set(reading.region, (regionCounts.get(reading.region) || 0) + 1);
        });
        regionCounts.forEach((count, region) => {
          ingestionSuccessTotal.inc({ region }, count);
        });
      }

      if (publishResult.failed > 0) {
        kafkaPublishErrors.inc({
          topic: kafkaProducer.getTopic(),
          error_type: 'batch_failure',
        }, publishResult.failed);
        ingestionErrorsTotal.inc({ error_type: 'kafka_publish' }, publishResult.failed);
      }

      const totalLatency = Date.now() - startTime;
      const batchSizeRange = getBatchSizeRange(readings.length);
      batchProcessingDuration.observe({ batch_size_range: batchSizeRange }, totalLatency);

      logger.info(
        {
          total: readings.length,
          accepted: publishResult.successful,
          duplicates: duplicates.length,
          failed: publishResult.failed,
          partitions: Array.from(publishResult.partitions),
          latency: totalLatency,
        },
        'Batch processing complete'
      );

      // Determine response status
      const status = publishResult.failed === 0 ? 'success' : 'partial';
      const httpStatus = publishResult.failed === 0 ? 200 : 207; // Multi-Status

      return res.status(httpStatus).json({
        status,
        accepted: publishResult.successful,
        duplicates: duplicates.length,
        failed: publishResult.failed,
        topic: kafkaProducer.getTopic(),
        partitions: Array.from(publishResult.partitions),
      });
    } catch (error) {
      ingestionErrorsTotal.inc({ error_type: 'internal' });
      logger.error({ error, ip: req.ip }, 'Internal error processing batch');
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  return router;
}
