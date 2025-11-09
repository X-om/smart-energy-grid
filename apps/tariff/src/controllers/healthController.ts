import { Request, Response } from 'express';
import { KafkaConsumerService } from '../services/kafkaConsumerService.js';
import { KafkaProducerService } from '../services/kafkaProducerService.js';
import { PostgresService } from '../services/postgresService.js';
import { RedisCacheService } from '../services/redisCacheService.js';

export const healthCheckController = (_req: Request, res: Response): void => {

  const kafkaConsumer = KafkaConsumerService.getInstance();
  const kafkaProducer = KafkaProducerService.getInstance();
  const db = PostgresService.getInstance();
  const cache = RedisCacheService.getInstance();

  const health = {
    status: 'ok', service: 'tariff',
    timestamp: new Date().toISOString(),
    connections: {
      kafka: kafkaConsumer.isConnected() && kafkaProducer.isConnected(),
      postgres: db.isConnected(),
      redis: cache.isConnected(),
    },
  };
  res.json(health);
};
