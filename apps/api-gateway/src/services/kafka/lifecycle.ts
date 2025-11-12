import { KafkaProducerService } from './producer.service';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

let kafkaProducer: KafkaProducerService | null = null;

export const connectKafka = async (): Promise<void> => {
  try {
    const brokers = env.KAFKA_BROKERS.split(',').map((broker) => broker.trim());

    kafkaProducer = KafkaProducerService.getInstance({
      brokers,
      clientId: env.KAFKA_CLIENT_ID,
    });

    await kafkaProducer.connect();
    logger.info({ brokers, clientId: env.KAFKA_CLIENT_ID }, 'Kafka producer connected');
  } catch (error) {
    logger.error({ error }, 'Failed to connect Kafka producer');
    throw error;
  }
};

export const disconnectKafka = async (): Promise<void> => {
  try {
    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      logger.info('Kafka producer disconnected');
    }
  } catch (error) {
    logger.error({ error }, 'Error disconnecting Kafka producer');
  }
};

export const getKafkaProducer = (): KafkaProducerService => {
  if (!kafkaProducer) {
    throw new Error('Kafka producer not initialized. Call connectKafka() first.');
  }
  return kafkaProducer;
};

export const isKafkaHealthy = (): boolean => {
  return kafkaProducer?.isHealthy() ?? false;
};
