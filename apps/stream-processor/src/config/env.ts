import dotenv from 'dotenv';

dotenv.config();

interface KafkaConfig {
  brokers: Array<string>;
  clientId: string;
  groupId: string;
  topicInput: string;
  topicAgg1m: string;
  topicAlerts: string;
  topicRegional1m: string;
}

interface RegionalCapacityConfig {
  [region: string]: number;
}

interface PostgresConfig {
  url: string;
}

interface Config {
  port: number;
  kafka: KafkaConfig;
  postgres: PostgresConfig;
  flushInterval1m: number;
  regionalCapacity: RegionalCapacityConfig;
}

const parseEnv = (): Config => ({
  port: parseInt(process.env.PORT || '3002', 10),
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'stream-processor',
    groupId: process.env.KAFKA_GROUP_ID || 'stream-processor-group',
    topicInput: process.env.KAFKA_TOPIC_INPUT || 'raw_readings',
    topicAgg1m: process.env.KAFKA_TOPIC_AGG_1M || 'aggregates_1m',
    topicAlerts: process.env.KAFKA_TOPIC_ALERTS || 'alerts',
    topicRegional1m: process.env.KAFKA_TOPIC_REGIONAL_AGG_1M || 'aggregates_1m_regional',
  },
  postgres: {
    url: process.env.POSTGRES_URL || 'postgresql://segs_user:segs_password@localhost:5433/segs_db',
  },
  flushInterval1m: parseInt(process.env.FLUSH_INTERVAL_1M || '60000', 10),
  regionalCapacity: {
    'Mumbai-North': 320000,
    'Mumbai-South': 288000,
    'Delhi-North': 352000,
    'Delhi-South': 320000,
    'Bangalore-East': 304000,
    'Bangalore-West': 272000,
    'Pune-East': 224000,
    'Pune-West': 208000,
    'Hyderabad-Central': 256000,
    'Chennai-North': 240000,
  },
});

export const config = parseEnv();
