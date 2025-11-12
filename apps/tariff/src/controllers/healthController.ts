import { Request, Response } from 'express';
import { KafkaConsumerService } from '../services/kafkaConsumerService';
import { KafkaProducerService } from '../services/kafkaProducerService';
import { PostgresService } from '../services/postgresService';
import { RedisCacheService } from '../services/redisCacheService';

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
