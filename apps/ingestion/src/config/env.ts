import dotenv from 'dotenv';

dotenv.config();

interface KafkaConfig {
  brokers: Array<string>;
  topic: string;
  clientId: string;
}

interface RedisConfig {
  url: string;
  dedupTtl: number;
}

interface Config {
  port: number;
  kafka: KafkaConfig;
  redis: RedisConfig;
}

const parseEnv = (): Config => ({
  port: parseInt(process.env.PORT || '3001', 10),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    topic: process.env.KAFKA_TOPIC || 'raw_readings',
    clientId: process.env.KAFKA_CLIENT_ID || 'ingestion-service',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    dedupTtl: parseInt(process.env.DEDUP_TTL || '60', 10),
  },
});

export const config = parseEnv();
