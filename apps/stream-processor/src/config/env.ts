import dotenv from 'dotenv';

dotenv.config();

interface KafkaConfig {
  brokers: Array<string>;
  clientId: string;
  groupId: string;
  topicInput: string;
  topicAgg1m: string;
  topicAgg15m: string;
  topicAlerts: string;
}

interface PostgresConfig {
  url: string;
}

interface Config {
  port: number;
  kafka: KafkaConfig;
  postgres: PostgresConfig;
  flushInterval1m: number;
  flushInterval15m: number;
}

const parseEnv = (): Config => ({
  port: parseInt(process.env.PORT || '3002', 10),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'stream-processor',
    groupId: process.env.KAFKA_GROUP_ID || 'stream-processor-group',
    topicInput: process.env.KAFKA_TOPIC_INPUT || 'raw_readings',
    topicAgg1m: process.env.KAFKA_TOPIC_AGG_1M || 'aggregates_1m',
    topicAgg15m: process.env.KAFKA_TOPIC_AGG_15M || 'aggregates_15m',
    topicAlerts: process.env.KAFKA_TOPIC_ALERTS || 'alerts',
  },
  postgres: {
    url: process.env.POSTGRES_URL || 'postgres://postgres:password@localhost:5432/segs',
  },
  flushInterval1m: parseInt(process.env.FLUSH_INTERVAL_1M || '60000', 10),
  flushInterval15m: parseInt(process.env.FLUSH_INTERVAL_15M || '900000', 10),
});

export const config = parseEnv();
