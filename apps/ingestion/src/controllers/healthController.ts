import { Request, Response } from 'express';
import { DeduplicationService } from '../services/redisDedupe';
import { KafkaProducerService } from '../services/kafkaProducer';

export const healthCheckController = (_req: Request, res: Response): void => {
  const dedupeService = DeduplicationService.getInstance();
  const kafkaProducer = KafkaProducerService.getInstance();

  const health = {
    status: 'ok', service: 'ingestion', timestamp: new Date().toISOString(), uptime: process.uptime(),
    connections: { redis: dedupeService.isConnected(), kafka: kafkaProducer.isConnected() },
  };

  const isHealthy = health.connections.redis && health.connections.kafka;
  res.status(isHealthy ? 200 : 503).json(health);
};
