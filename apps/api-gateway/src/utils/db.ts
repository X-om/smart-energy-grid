import pg from 'pg';
import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';
const { Pool } = pg;

export const postgresPool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  max: 20,
});
postgresPool.on('error', (err) => logger.error('Unexpected PostgreSQL error', err));
export const pool = postgresPool;

// TimescaleDB Pool
export const timescalePool = new Pool({
  host: env.TIMESCALE_HOST,
  port: env.TIMESCALE_PORT,
  user: env.TIMESCALE_USER,
  password: env.TIMESCALE_PASSWORD,
  database: env.TIMESCALE_DB,
  max: 20,
});
timescalePool.on('error', (err) => logger.error('Unexpected TimescaleDB error', err));

// Redis Client
export const redisClient: RedisClientType = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    reconnectStrategy: false,
  }
});

redisClient.on('error', (err) => {
  if (err.code !== 'ECONNREFUSED') {
    logger.error('Redis error', err);
  }
});

export const connectDatabases = async (): Promise<void> => {
  const errors: string[] = [];

  try {
    await postgresPool.query('SELECT 1');
    logger.info('✓ PostgreSQL connected');
  } catch (error) {
    errors.push('PostgreSQL');
    logger.warn('⚠ PostgreSQL connection failed (will retry on first use)');
  }

  try {
    await timescalePool.query('SELECT 1');
    logger.info('✓ TimescaleDB connected');
  } catch (error) {
    errors.push('TimescaleDB');
    logger.warn('⚠ TimescaleDB connection failed (will retry on first use)');
  }

  try {
    await redisClient.connect();
    logger.info('✓ Redis connected');
  } catch (error) {
    errors.push('Redis');
    logger.warn('⚠ Redis connection failed (will retry on first use)');
  }

  if (errors.length === 3) {
    logger.error('All database connections failed');
    throw new Error('Failed to connect to all databases');
  }
}

export const disconnectDatabases = async (): Promise<void> => {
  await postgresPool.end();
  await timescalePool.end();

  // Only disconnect if Redis was connected
  if (redisClient.isOpen) {
    await redisClient.quit();
  }

  logger.info('All database connections closed');
}
