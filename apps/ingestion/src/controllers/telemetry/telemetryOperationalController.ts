import { Request, Response } from 'express';
import { Reading } from '../../schemas/zodSchemas.js';
import { KafkaProducerService } from '../../services/kafkaProducer.js';
import { createLogger } from '../../utils/logger.js';
import { ingestionSuccessTotal, ingestionErrorsTotal, kafkaProduceLatency, kafkaMessagesPublished, kafkaPublishErrors, batchSizeHistogram, batchProcessingDuration } from '../../metrics/metrics.js';

const logger = createLogger('telemetry-controller');

const getBatchSizeRange = (size: number): string => {
  if (size <= 10) return '1-10';
  if (size <= 50) return '11-50';
  if (size <= 100) return '51-100';
  if (size <= 500) return '101-500';
  return '501+';
};

export const singleTelemetryReadingController = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const reading: Reading = req.body;
    const kafkaProducer = KafkaProducerService.getInstance();

    const publishStart = Date.now();
    const result = await kafkaProducer.publishReading(reading);
    const publishLatency = Date.now() - publishStart;

    kafkaProduceLatency.observe({ topic: kafkaProducer.getTopic() }, publishLatency);

    if (result.success) {
      kafkaMessagesPublished.inc({ topic: kafkaProducer.getTopic(), partition: result.partition?.toString() || 'unknown' });
      ingestionSuccessTotal.inc({ region: reading.region });
      logger.info({ meterId: reading.meterId, partition: result.partition, offset: result.offset, latency: Date.now() - startTime }, 'Reading ingested successfully');

      return void res.status(200).json({ status: 'success', meterId: reading.meterId, topic: kafkaProducer.getTopic(), partition: result.partition, offset: result.offset });
    }

    kafkaPublishErrors.inc({ topic: kafkaProducer.getTopic(), error_type: result.error?.name || 'unknown' });
    ingestionErrorsTotal.inc({ error_type: 'kafka_publish' });
    logger.error({ error: result.error, meterId: reading.meterId }, 'Failed to publish reading');

    return void res.status(500).json({ status: 'error', message: 'Failed to publish reading', meterId: reading.meterId });

  } catch (error) {
    ingestionErrorsTotal.inc({ error_type: 'internal' });
    logger.error({ error }, 'Internal error in single reading controller');

    return void res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};


export const batchTelemetryReadingController = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { unique, duplicates } = req.body as { unique: Array<Reading>; duplicates: Array<Reading> };
    const totalCount = unique.length + duplicates.length;

    batchSizeHistogram.observe(totalCount);

    const kafkaProducer = KafkaProducerService.getInstance();
    const publishStart = Date.now();
    const publishResult = await kafkaProducer.publishBatch(unique);
    const publishLatency = Date.now() - publishStart;

    kafkaProduceLatency.observe({ topic: kafkaProducer.getTopic() }, publishLatency);

    if (publishResult.successful > 0) {
      publishResult.partitions.forEach((partition) =>
        kafkaMessagesPublished.inc({ topic: kafkaProducer.getTopic(), partition: partition.toString() }, publishResult.successful / publishResult.partitions.size)
      );

      const regionCounts = new Map<string, number>();
      unique.forEach((reading) => regionCounts.set(reading.region, (regionCounts.get(reading.region) || 0) + 1));
      regionCounts.forEach((count, region) => ingestionSuccessTotal.inc({ region }, count));
    }

    if (publishResult.failed > 0) {
      kafkaPublishErrors.inc({ topic: kafkaProducer.getTopic(), error_type: 'batch_failure' }, publishResult.failed);
      ingestionErrorsTotal.inc({ error_type: 'kafka_publish' }, publishResult.failed);
    }

    const totalLatency = Date.now() - startTime;
    const batchSizeRange = getBatchSizeRange(totalCount);
    batchProcessingDuration.observe({ batch_size_range: batchSizeRange }, totalLatency);

    logger.info({
      total: totalCount, accepted: publishResult.successful, duplicates: duplicates.length,
      failed: publishResult.failed, partitions: Array.from(publishResult.partitions), latency: totalLatency
    }, 'Batch processing complete');

    const status = publishResult.failed === 0 ? 'success' : 'partial';
    const httpStatus = publishResult.failed === 0 ? 200 : 207;

    return void res.status(httpStatus).json({
      status, accepted: publishResult.successful,
      duplicates: duplicates.length, failed: publishResult.failed, topic: kafkaProducer.getTopic(), partitions: Array.from(publishResult.partitions)
    });
  } catch (error) {
    ingestionErrorsTotal.inc({ error_type: 'internal' });
    logger.error({ error }, 'Internal error in batch reading controller');

    return void res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};
