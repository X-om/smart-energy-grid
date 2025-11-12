import 'dotenv/config';

export interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly serviceName: string;
}

export interface KafkaConfig {
  readonly brokers: Array<string>;
  readonly clientId: string;
  readonly groupId: string;
  readonly topicAlertsProcessed: string;
  readonly topicAlertStatusUpdates: string;
  readonly topicTariffUpdates: string;
  readonly topicBillingUpdates: string;
  readonly topicPaymentUpdates: string;
  readonly topicDisputeUpdates: string;
}

export interface WebSocketConfig {
  readonly path: string;
  readonly heartbeatInterval: number;
  readonly maxConnections: number;
  readonly jwtSecret: string;
}

export const Config = {
  server: {
    port: parseInt(process.env.PORT || '3003', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceName: 'notification-service'
  } as ServerConfig,

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
    groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
    topicAlertsProcessed: 'alerts_processed',
    topicAlertStatusUpdates: 'alert_status_updates',
    topicTariffUpdates: 'tariff_updates',
    topicBillingUpdates: 'billing_updates',
    topicPaymentUpdates: 'payment_updates',
    topicDisputeUpdates: 'dispute_updates'
  } as KafkaConfig,

  websocket: {
    path: '/ws',
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || '30000', 10),
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '10000', 10),
    jwtSecret: process.env.JWT_SECRET || 'mysecretkey'
  } as WebSocketConfig
};
