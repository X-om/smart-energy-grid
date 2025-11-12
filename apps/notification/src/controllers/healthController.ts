import { Request, Response } from 'express';
import { KafkaConsumerService } from '../services/kafkaConsumerService';
import { WebSocketService } from '../services/webSocketService';

export const getHealth = (_req: Request, res: Response): void => {
  const kafkaConsumer = KafkaConsumerService.getInstance();
  const wsService = WebSocketService.getInstance();

  const health = {
    status: 'healthy', timestamp: new Date().toISOString(),
    service: 'notification-service', version: '1.0.0',
    uptime: process.uptime(), connections: {
      kafka: kafkaConsumer.isHealthy(), websocket: true
    },
    websocket: wsService.getStats()
  };
  const allHealthy = Object.values(health.connections).every(status => status);

  if
    (allHealthy) res.json(health);
  else
    res.status(503).json({ ...health, status: 'unhealthy' });
};

export const getClients = (_req: Request, res: Response): void => {
  const wsService = WebSocketService.getInstance();
  const stats = wsService.getStats();

  res.json({ success: true, data: stats });
};
