import { Consumer, Kafka, EachMessagePayload } from 'kafkajs';
import { kafkaLogger as logger } from '../utils/logger.js';
import { wsServer } from '../ws/server.js';
import { metricsService } from '../metrics/metrics.js';

export interface AlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  timestamp: string;
  status: string;
  metadata?: Record<string, any>;
}

export interface TariffMessage {
  id: string;
  region: string;
  tier: string;
  price_per_kwh: number;
  effective_from: string;
  effective_until?: string;
  time_of_use?: string;
  metadata?: Record<string, any>;
}

class KafkaConsumerService {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected = false;
  private topics: string[];

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID || 'notification-service';
    const groupId = process.env.KAFKA_GROUP_ID || 'notification-group';
    this.topics = (process.env.KAFKA_TOPICS || 'alerts_processed,tariff_updates').split(',');

    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 100,
      allowAutoTopicCreation: false
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Kafka event handlers
   */
  private setupEventHandlers(): void {
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected');
      this.isConnected = true;
      metricsService.setKafkaConnectionStatus(true);
    });

    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka consumer disconnected');
      this.isConnected = false;
      metricsService.setKafkaConnectionStatus(false);
    });

    this.consumer.on('consumer.group_join', ({ payload }) => {
      logger.info('Kafka consumer joined group', {
        groupId: payload.groupId,
        memberId: payload.memberId,
        leaderId: payload.leaderId,
        isLeader: payload.isLeader,
        memberAssignment: payload.memberAssignment
      });
    });

    this.consumer.on('consumer.heartbeat', () => {
      logger.debug('Kafka consumer heartbeat');
    });

    this.consumer.on('consumer.crash', ({ payload }) => {
      logger.error('Kafka consumer crashed', {
        error: payload.error,
        groupId: payload.groupId
      });
      this.isConnected = false;
      metricsService.setKafkaConnectionStatus(false);
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      logger.info('Kafka consumer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka consumer', error);
      throw error;
    }
  }

  /**
   * Subscribe to topics
   */
  async subscribe(): Promise<void> {
    try {
      for (const topic of this.topics) {
        await this.consumer.subscribe({
          topic: topic.trim(),
          fromBeginning: false
        });
        logger.info('Subscribed to topic', { topic: topic.trim() });
      }
    } catch (error) {
      logger.error('Failed to subscribe to topics', error);
      throw error;
    }
  }

  /**
   * Start consuming messages
   */
  async startConsuming(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        }
      });

      logger.info('Kafka consumer started consuming messages', {
        topics: this.topics
      });
    } catch (error) {
      logger.error('Failed to start consuming messages', error);
      throw error;
    }
  }

  /**
   * Handle incoming Kafka message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      if (!message.value) {
        logger.warn('Received message with no value', { topic, partition });
        return;
      }

      const messageValue = message.value.toString();

      logger.debug('Processing message', {
        topic,
        partition,
        offset: message.offset,
        size: messageValue.length
      });

      // Update metrics
      metricsService.incrementKafkaMessagesConsumed(topic);

      // Route message based on topic
      switch (topic) {
        case 'alerts_processed':
          await this.handleAlertMessage(messageValue);
          break;

        case 'tariff_updates':
          await this.handleTariffMessage(messageValue);
          break;

        default:
          logger.warn('Unknown topic received', { topic });
      }

      const processingTime = Date.now() - startTime;
      metricsService.recordKafkaProcessingDuration(topic, processingTime);

      logger.debug('Message processed successfully', {
        topic,
        partition,
        offset: message.offset,
        processingTimeMs: processingTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error processing message', {
        topic,
        partition,
        offset: message.offset,
        error: errorMessage
      });

      metricsService.incrementKafkaProcessingErrors(topic, 'processing_error');

      // Don't throw error to avoid stopping consumer
    }
  }

  /**
   * Handle alert message
   */
  private async handleAlertMessage(messageValue: string): Promise<void> {
    try {
      const alert: AlertMessage = JSON.parse(messageValue);

      logger.info('Alert message received', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        region: alert.region,
        status: alert.status
      });

      // Broadcast to alerts channel
      wsServer.broadcast(
        'alerts',
        {
          type: 'ALERT',
          payload: alert
        },
        'alerts_processed'
      );

      // Broadcast to region-specific channel if region is present
      if (alert.region) {
        wsServer.broadcast(
          `region:${alert.region}`,
          {
            type: 'ALERT',
            payload: alert
          },
          'alerts_processed'
        );
      }

      // Broadcast to meter-specific channel if meter_id is present
      if (alert.meter_id) {
        wsServer.broadcast(
          `meter:${alert.meter_id}`,
          {
            type: 'ALERT',
            payload: alert
          },
          'alerts_processed'
        );
      }

    } catch (error) {
      logger.error('Failed to process alert message', error);
      throw error;
    }
  }

  /**
   * Handle tariff message
   */
  private async handleTariffMessage(messageValue: string): Promise<void> {
    try {
      const tariff: TariffMessage = JSON.parse(messageValue);

      logger.info('Tariff message received', {
        id: tariff.id,
        region: tariff.region,
        tier: tariff.tier,
        pricePerKwh: tariff.price_per_kwh,
        effectiveFrom: tariff.effective_from
      });

      // Broadcast to tariffs channel
      wsServer.broadcast(
        'tariffs',
        {
          type: 'TARIFF_UPDATE',
          payload: tariff
        },
        'tariff_updates'
      );

      // Broadcast to region-specific channel
      wsServer.broadcast(
        `region:${tariff.region}`,
        {
          type: 'TARIFF_UPDATE',
          payload: tariff
        },
        'tariff_updates'
      );

    } catch (error) {
      logger.error('Failed to process tariff message', error);
      throw error;
    }
  }

  /**
   * Check if consumer is healthy
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      metricsService.setKafkaConnectionStatus(false);
      logger.info('Kafka consumer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka consumer', error);
      throw error;
    }
  }
}

export const kafkaConsumer = new KafkaConsumerService();
