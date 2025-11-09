import { Request, Response } from 'express';
import { PostgresService } from '../services/postgresService.js';
import { RedisCacheService } from '../services/redisCacheService.js';
import { KafkaConsumerService } from '../services/kafkaConsumerService.js';
import { KafkaProducerService } from '../services/kafkaProducerService.js';
import { Config } from '../config/env.js';

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  const postgresService = PostgresService.getInstance();
  const redisService = RedisCacheService.getInstance();
  const kafkaConsumer = KafkaConsumerService.getInstance();
  const kafkaProducer = KafkaProducerService.getInstance();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: Config.server.serviceName,
    version: process.env.npm_package_version || '1.0.0',
    environment: Config.server.nodeEnv,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      postgres: await postgresService.healthCheck(),
      redis: redisService.isHealthy(),
      kafka_consumer: kafkaConsumer.isHealthy(),
      kafka_producer: kafkaProducer.isHealthy()
    }
  };

  const allHealthy = Object.values(health.connections).every(status => status);

  if (allHealthy) {
    res.json(health);
  } else {
    res.status(503).json({ ...health, status: 'unhealthy' });
  }
};

export const getMetrics = async (_req: Request, res: Response): Promise<void> => {
  const metrics = `# HELP alert_service_uptime_seconds Service uptime in seconds
# TYPE alert_service_uptime_seconds gauge
alert_service_uptime_seconds ${process.uptime()}

# HELP alert_service_memory_usage_bytes Memory usage in bytes
# TYPE alert_service_memory_usage_bytes gauge
alert_service_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
alert_service_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}
alert_service_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}
`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
};
