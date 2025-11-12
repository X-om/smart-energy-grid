import { Request, Response } from 'express';
import { postgresPool, timescalePool, redisClient } from '../utils/db';
import { isKafkaHealthy } from '../services/kafka/lifecycle';
import { ApiResponse } from '../types/index';

export async function healthController(_req: Request, res: Response): Promise<void> {
  let postgresStatus = 'down';
  let timescaleStatus = 'down';
  let redisStatus = 'down';
  let kafkaStatus = 'down';

  try {
    await postgresPool.query('SELECT 1');
    postgresStatus = 'up';
  } catch (error) {/* PostgreSQL is down */ }

  try {
    await timescalePool.query('SELECT 1');
    timescaleStatus = 'up';
  } catch (error) {/* TimescaleDB is down */ }

  try {
    await redisClient.ping();
    redisStatus = 'up';
  } catch (error) {/* Redis is down */ }

  try {
    kafkaStatus = isKafkaHealthy() ? 'up' : 'down';
  } catch (error) {/* Kafka is down */ }

  const allUp = postgresStatus === 'up' && timescaleStatus === 'up' && redisStatus === 'up' && kafkaStatus === 'up';
  const statusCode = allUp ? 200 : 503;

  const response: ApiResponse<{ status: string; timestamp: string; uptime: number; services: { postgres: string; timescale: string; redis: string; kafka: string; }; }> = {
    success: allUp, data: {
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(), uptime: process.uptime(),
      services: { postgres: postgresStatus, timescale: timescaleStatus, redis: redisStatus, kafka: kafkaStatus }
    },
  };
  return void res.status(statusCode).json(response);
}
