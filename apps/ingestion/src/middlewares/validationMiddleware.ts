import { Request, Response, NextFunction } from 'express';
import { readingSchema, batchReadingsSchema } from '../schemas/zodSchemas.js';
import { createLogger } from '../utils/logger.js';
import { validationErrorsTotal } from '../metrics/metrics.js';

const logger = createLogger('validation-middleware');

export const validateSingleReading = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = readingSchema.safeParse(req.body);

    if (!result.success) {
      validationErrorsTotal.inc({ field: 'single_reading' });
      logger.warn({ errors: result.error.errors, ip: req.ip }, 'Single reading validation failed');

      return void res.status(400).json({
        status: 'error', message: 'Validation failed', errors: result.error.errors.map((err) => ({ field: err.path.join('.'), message: err.message }))
      });
    }
    req.body = result.data;
    next();
  } catch (error) {
    logger.error({ error }, 'Error in validation middleware');
    res.status(500).json({ status: 'error', message: 'Internal validation error' });
  }
};

export const validateBatchReadings = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const result = batchReadingsSchema.safeParse(req.body);

    if (!result.success) {
      validationErrorsTotal.inc({ field: 'batch_readings' });
      logger.warn({ errors: result.error.errors, ip: req.ip }, 'Batch readings validation failed');

      return void res.status(400).json({
        status: 'error', message: 'Validation failed', errors: result.error.errors.map((err) => ({ field: err.path.join('.'), message: err.message }))
      });
    }

    req.body = result.data;
    next();
  } catch (error) {
    logger.error({ error }, 'Error in validation middleware');
    res.status(500).json({ status: 'error', message: 'Internal validation error' });
  }
};
