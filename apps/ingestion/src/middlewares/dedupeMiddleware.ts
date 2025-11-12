import { Request, Response, NextFunction } from 'express';
import { DeduplicationService } from '../services/redisDedupe';
import { Reading } from '../schemas/zodSchemas';
import { createLogger } from '../utils/logger';
import { deduplicatedMessagesTotal, deduplicationCheckDuration } from '../metrics/metrics';

const logger = createLogger('dedupe-middleware');

export const checkSingleTelemetryDuplicate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const startTime = Date.now();
    const reading: Reading = req.body;
    const dedupeService = DeduplicationService.getInstance();
    const isNew = await dedupeService.checkAndMark(reading.meterId, reading.timestamp);
    const duration = Date.now() - startTime;

    deduplicationCheckDuration.observe(duration);

    if (!isNew) {
      deduplicatedMessagesTotal.inc();
      logger.debug({ meterId: reading.meterId, timestamp: reading.timestamp }, 'Duplicate reading detected');

      return void res.status(200).json({ status: 'success', message: 'Reading already processed', duplicate: true, meterId: reading.meterId });
    }
    next();
  } catch (error) {
    logger.error({ error }, 'Error in deduplication check');
    next(error);
  }
};

export const checkBatchTelemetryDuplicate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const startTime = Date.now();
    const readings: Array<Reading> = req.body;
    const dedupeService = DeduplicationService.getInstance();
    const { unique, duplicates } = await dedupeService.filterDuplicates(readings);
    const duration = Date.now() - startTime;

    deduplicationCheckDuration.observe(duration);

    if (duplicates.length > 0) {
      deduplicatedMessagesTotal.inc(duplicates.length);
      logger.debug({ total: readings.length, unique: unique.length, duplicates: duplicates.length }, 'Filtered duplicate readings');
    }

    if (unique.length === 0)
      return void res.status(200).json({ status: 'success', message: 'All readings were duplicates', accepted: 0, duplicates: duplicates.length });

    req.body = { unique, duplicates };
    next();
  } catch (error) {
    logger.error({ error }, 'Error in batch deduplication check');
    next(error);
  }
};
