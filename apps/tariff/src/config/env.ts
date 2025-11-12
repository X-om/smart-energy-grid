import dotenv from 'dotenv';

dotenv.config();

// Build PostgreSQL URL from individual env vars or use POSTGRES_URL
const buildPostgresUrl = (): string => {
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'segs_db';
  const user = process.env.POSTGRES_USER || 'segs_user';
  const password = process.env.POSTGRES_PASSWORD || 'segs_password';

  return `postgres://${user}:${password}@${host}:${port}/${db}`;
};

// Build Redis URL from individual env vars or use REDIS_URL
const buildRedisUrl = (): string => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';

  return `redis://${host}:${port}`;
};

export const config = {
  port: parseInt(process.env.PORT || '3005', 10),
  basePrice: parseFloat(process.env.BASE_PRICE || '5.0'),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'tariff-service',
    groupId: process.env.KAFKA_GROUP_ID || 'tariff-group',
    topicInput: process.env.KAFKA_TOPIC_INPUT || 'aggregates_1m_regional',
    topicOutput: process.env.KAFKA_TOPIC_OUTPUT || 'tariff_updates',
  },
  postgres: {
    url: buildPostgresUrl(),
  },
  redis: {
    url: buildRedisUrl(),
  },
  thresholds: {
    minChangeThreshold: parseFloat(process.env.MIN_CHANGE_THRESHOLD || '0.01'),
    criticalLoadThreshold: 90,
    highLoadThreshold: 75,
    normalLoadThreshold: 50,
    lowLoadThreshold: 25,
  },
};
