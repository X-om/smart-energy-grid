export interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly serviceName: string;
}
export interface PostgresConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly maxConnections: number;
}
export interface RedisConfig {
  readonly url: string;
  readonly ttl: number;
}
export interface KafkaConfig {
  readonly brokers: string[];
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