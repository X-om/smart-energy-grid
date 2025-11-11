import 'dotenv/config';

export interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly serviceName: string;
}

export interface PostgresConfig {
  readonly connectionString: string;
}

export interface RedisConfig {
  readonly url: string;
  readonly ttl: number;
}

export interface KafkaConfig {
  readonly brokers: Array<string>;
  readonly clientId: string;
  readonly groupId: string;
  readonly topicAggregates: string;
  readonly topicAlerts: string;
  readonly topicAlertsProcessed: string;
  readonly topicAlertStatusUpdates: string;
  readonly topicServiceHealth: string;
}

export interface AlertThresholds {
  readonly regionalOverloadPercent: number;
  readonly overloadConsecutiveWindows: number;
  readonly meterOutageSeconds: number;
  readonly deduplicationMinutes: number;
}

// Helper to build PostgreSQL URL from individual env vars
const buildPostgresUrl = (): string => {
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'segs_db';
  const user = process.env.POSTGRES_USER || 'segs_user';
  const password = process.env.POSTGRES_PASSWORD || 'segs_password';

  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
};

// Helper to build Redis URL from individual env vars
const buildRedisUrl = (): string => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';

  return `redis://${host}:${port}`;
};

export const Config = {
  server: {
    port: parseInt(process.env.PORT || '3004', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceName: 'alert-service'
  } as ServerConfig,

  postgres: {
    connectionString: process.env.POSTGRES_URL || buildPostgresUrl()
  } as PostgresConfig,

  redis: {
    url: process.env.REDIS_URL || buildRedisUrl(),
    ttl: 3600
  } as RedisConfig,

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'alert-service',
    groupId: process.env.KAFKA_GROUP_ID || 'alert-group',
    topicAggregates: 'aggregates_1m_regional',
    topicAlerts: 'alerts',
    topicAlertsProcessed: 'alerts_processed',
    topicAlertStatusUpdates: 'alert_status_updates',
    topicServiceHealth: 'service_health'
  } as KafkaConfig,

  alertThresholds: {
    regionalOverloadPercent: 90,
    overloadConsecutiveWindows: 2,
    meterOutageSeconds: 30,
    deduplicationMinutes: 5
  } as AlertThresholds
};
