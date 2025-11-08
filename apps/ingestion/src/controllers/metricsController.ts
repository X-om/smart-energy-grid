import { Request, Response } from 'express';
import { register, redisConnectionStatus, kafkaConnectionStatus } from '../metrics/metrics.js';
import { DeduplicationService } from '../services/redisDedupe.js';
import { KafkaProducerService } from '../services/kafkaProducer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('metrics-controller');
export const ingestionMetricsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const dedupeService = DeduplicationService.getInstance();
    const kafkaProducer = KafkaProducerService.getInstance();

    redisConnectionStatus.set(dedupeService.isConnected() ? 1 : 0);
    kafkaConnectionStatus.set(kafkaProducer.isConnected() ? 1 : 0);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error({ error }, 'Error generating metrics');
    res.status(500).json({ status: 'error', message: 'Failed to generate metrics' });
  }
};
