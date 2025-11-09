/**
 * Kafka utility functions shared across services.
 * Provides common helpers for Kafka configuration and operation.
 */

/**
 * Convert application log level to KafkaJS log level integer.
 * 
 * KafkaJS uses numeric log levels:
 * - 0: NOTHING
 * - 1: ERROR
 * - 2: WARN
 * - 4: INFO
 * - 5: DEBUG
 * 
 * @param logLevel - Application log level string (default from process.env.LOG_LEVEL or 'info')
 * @returns KafkaJS numeric log level
 * 
 * @example
 * ```typescript
 * import { getKafkaLogLevel } from '@segs/utils';
 * 
 * const kafka = new Kafka({
 *   clientId: 'my-service',
 *   brokers: ['localhost:9092'],
 *   logLevel: getKafkaLogLevel()
 * });
 * ```
 */
export function getKafkaLogLevel(logLevel?: string): number {
  const level = logLevel || process.env.LOG_LEVEL || 'info';

  const levelMap: Record<string, number> = {
    error: 1,
    warn: 2,
    info: 4,
    debug: 5,
  };

  return levelMap[level.toLowerCase()] || 4;
}

/**
 * Common Kafka producer configuration settings.
 * Services can extend this with service-specific options.
 */
export const commonProducerConfig = {
  allowAutoTopicCreation: false,
  transactionTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
};

/**
 * Common Kafka consumer configuration settings.
 * Services can extend this with service-specific options.
 */
export const commonConsumerConfig = {
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 100,
  allowAutoTopicCreation: false,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
};

/**
 * Common Kafka client retry configuration.
 */
export const commonRetryConfig = {
  initialRetryTime: 300,
  retries: 8,
  multiplier: 2,
  maxRetryTime: 30000,
};
