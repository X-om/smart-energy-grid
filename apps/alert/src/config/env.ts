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

export const Config = {
  server: {
    port: parseInt(process.env.PORT || '3004', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceName: 'alert-service'
  } as ServerConfig,

  postgres: {
    connectionString: process.env.POSTGRES_URL || 'postgresql://energy_user:energy_pass@localhost:5432/energy_grid'
  } as PostgresConfig,

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
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
