import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  basePrice: parseFloat(process.env.BASE_PRICE || '5.0'),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'tariff-service',
    groupId: process.env.KAFKA_GROUP_ID || 'tariff-group',
    topicInput: process.env.KAFKA_TOPIC_INPUT || 'aggregates_1m_regional',
    topicOutput: process.env.KAFKA_TOPIC_OUTPUT || 'tariff_updates',
  },
  postgres: {
    url: process.env.POSTGRES_URL || 'postgres://segs_user:segs_password@localhost:5432/segs_db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  thresholds: {
    minChangeThreshold: 0.1,
    criticalLoadThreshold: 90,
    highLoadThreshold: 75,
    normalLoadThreshold: 50,
    lowLoadThreshold: 25,
  },
};
