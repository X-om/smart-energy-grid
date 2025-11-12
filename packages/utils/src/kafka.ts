export function getKafkaLogLevel(logLevel?: string): number {
  const level = logLevel || process.env.LOG_LEVEL || 'info';
  const levelMap: Record<string, number> = { error: 1, warn: 2, info: 4, debug: 5 };
  return levelMap[level.toLowerCase()] || 4;
}

export const commonProducerConfig = {
  allowAutoTopicCreation: false,
  transactionTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
};

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

export const commonRetryConfig = {
  initialRetryTime: 300,
  retries: 8,
  multiplier: 2,
  maxRetryTime: 30000,
};
