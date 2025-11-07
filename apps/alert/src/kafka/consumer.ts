import { Consumer, Kafka, EachMessagePayload } from 'kafkajs';
import { kafkaLogger as logger } from '../utils/logger.js';
import { alertManager } from '../services/alertManager.js';
import { redisService } from '../services/redis.js';

export interface AggregateMessage {
  region: string;
  timestamp: string;
  meter_count: number;
  total_consumption: number;
  avg_consumption: number;
  max_consumption: number;
  min_consumption: number;
  load_percentage: number;
  active_meters: string[];
}

export interface AlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'alert-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.consumer = this.kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || 'alert-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 100,
      allowAutoTopicCreation: false
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected');
      this.isConnected = true;
    });

    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka consumer disconnected');
      this.isConnected = false;
    });

    this.consumer.on('consumer.crash', (event) => {
      logger.error('Kafka consumer crashed:', event.payload.error);
      this.isConnected = false;
    });

    this.consumer.on('consumer.group_join', (event) => {
      logger.info('Kafka consumer joined group:', event.payload);
    });

    this.consumer.on('consumer.heartbeat', (event) => {
      logger.debug('Kafka consumer heartbeat:', {
        groupId: event.payload.groupId,
        memberId: event.payload.memberId
      });
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();

      // Subscribe to topics
      await this.consumer.subscribe({
        topics: ['aggregates_1m', 'alerts'],
        fromBeginning: false
      });

      logger.info('Kafka consumer subscribed to topics: aggregates_1m, alerts');
    } catch (error) {
      logger.error('Failed to connect Kafka consumer:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      logger.info('Kafka consumer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka consumer:', error);
      throw error;
    }
  }

  async startConsuming(): Promise<void> {
    try {
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        }
      });

      logger.info('Kafka consumer started consuming messages');
    } catch (error) {
      logger.error('Failed to start consuming messages:', error);
      throw error;
    }
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn('Received empty message', { topic, partition });
        return;
      }

      const messageValue = message.value.toString();
      const startTime = Date.now();

      logger.debug('Processing message', {
        topic,
        partition,
        offset: message.offset,
        size: messageValue.length
      });

      switch (topic) {
        case 'aggregates_1m':
          await this.handleAggregateMessage(messageValue);
          break;

        case 'alerts':
          await this.handleAlertMessage(messageValue);
          break;

        default:
          logger.warn('Unknown topic received', { topic });
      }

      const processingTime = Date.now() - startTime;
      logger.debug('Message processed successfully', {
        topic,
        partition,
        offset: message.offset,
        processingTimeMs: processingTime
      });

    } catch (error) {
      logger.error('Error processing message', {
        topic,
        partition,
        offset: message.offset,
        error: error instanceof Error ? error.message : String(error)
      });

      // Don't throw error to avoid stopping consumer
      // In production, you might want to send to a dead letter queue
    }
  }

  private async handleAggregateMessage(messageValue: string): Promise<void> {
    try {
      const aggregate: AggregateMessage = JSON.parse(messageValue);

      logger.debug('Processing aggregate message', {
        region: aggregate.region,
        loadPercentage: aggregate.load_percentage,
        meterCount: aggregate.meter_count
      });

      // Update meter last seen timestamps
      for (const meterId of aggregate.active_meters) {
        await redisService.updateMeterLastSeen(
          meterId,
          aggregate.region,
          new Date(aggregate.timestamp)
        );
      }

      // Update region load for overload detection
      await redisService.updateRegionLoad(
        aggregate.region,
        aggregate.load_percentage,
        new Date(aggregate.timestamp)
      );

      // Check for regional overload (>90% load)
      if (aggregate.load_percentage > 90) {
        await this.checkRegionalOverload(aggregate);
      }

      // Check for meter outages
      await this.checkMeterOutages(aggregate);

    } catch (error) {
      logger.error('Failed to process aggregate message:', error);
      throw error;
    }
  }

  private async handleAlertMessage(messageValue: string): Promise<void> {
    try {
      const alertData: AlertMessage = JSON.parse(messageValue);

      logger.debug('Processing alert message', {
        id: alertData.id,
        type: alertData.type,
        region: alertData.region,
        meterId: alertData.meter_id
      });

      // Forward anomaly alerts from stream processor
      if (alertData.type === 'anomaly') {
        await alertManager.createAlert({
          type: alertData.type,
          severity: alertData.severity,
          region: alertData.region,
          meter_id: alertData.meter_id,
          message: alertData.message,
          metadata: {
            ...alertData.metadata,
            source: 'stream-processor',
            original_id: alertData.id
          }
        });
      }

    } catch (error) {
      logger.error('Failed to process alert message:', error);
      throw error;
    }
  }

  private async checkRegionalOverload(aggregate: AggregateMessage): Promise<void> {
    try {
      const region = aggregate.region;
      const timestamp = new Date(aggregate.timestamp);

      // Add overload window
      await redisService.addOverloadWindow(region, timestamp);

      // Check if we have 2 consecutive overload windows (within 5 minutes)
      const windowCount = await redisService.getOverloadWindowCount(region, 300000); // 5 minutes

      if (windowCount >= 2) {
        // Check if we already have an active regional overload alert
        const hasActiveAlert = await redisService.hasActiveAlert(region, 'REGIONAL_OVERLOAD');

        if (!hasActiveAlert) {
          logger.info('Regional overload detected', {
            region,
            loadPercentage: aggregate.load_percentage,
            windowCount
          });

          await alertManager.createAlert({
            type: 'REGIONAL_OVERLOAD',
            severity: 'high',
            region: region,
            message: `Regional overload detected: ${aggregate.load_percentage.toFixed(1)}% load for ${windowCount} consecutive time windows`,
            metadata: {
              load_percentage: aggregate.load_percentage,
              meter_count: aggregate.meter_count,
              total_consumption: aggregate.total_consumption,
              window_count: windowCount,
              timestamp: aggregate.timestamp
            }
          });

          // Mark as active to prevent duplicates
          await redisService.setActiveAlert(region, 'REGIONAL_OVERLOAD');
        }
      }

    } catch (error) {
      logger.error('Failed to check regional overload:', error);
      throw error;
    }
  }

  private async checkMeterOutages(aggregate: AggregateMessage): Promise<void> {
    try {
      const region = aggregate.region;
      const timestamp = new Date(aggregate.timestamp);
      const outageThreshold = 30000; // 30 seconds

      // Get inactive meters
      const inactiveMeters = await redisService.getInactiveMeters(outageThreshold);

      // Filter for meters in this region that are not in the current active list
      const outagedMeters = inactiveMeters.filter(meter =>
        meter.region === region &&
        !aggregate.active_meters.includes(meter.meter_id)
      );

      for (const meter of outagedMeters) {
        // Check if we already have an active outage alert for this meter
        const hasActiveAlert = await redisService.hasActiveAlert(region, 'METER_OUTAGE', meter.meter_id);

        if (!hasActiveAlert) {
          const outageTime = timestamp.getTime() - meter.last_seen.getTime();

          logger.info('Meter outage detected', {
            meterId: meter.meter_id,
            region: meter.region,
            outageTimeMs: outageTime
          });

          await alertManager.createAlert({
            type: 'METER_OUTAGE',
            severity: 'medium',
            region: meter.region,
            meter_id: meter.meter_id,
            message: `Meter outage detected: No data received for ${Math.round(outageTime / 1000)} seconds`,
            metadata: {
              last_seen: meter.last_seen.toISOString(),
              outage_duration_ms: outageTime,
              detection_timestamp: timestamp.toISOString()
            }
          });

          // Mark as active to prevent duplicates
          await redisService.setActiveAlert(region, 'METER_OUTAGE', meter.meter_id);
        }
      }

    } catch (error) {
      logger.error('Failed to check meter outages:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  async getConsumerGroupMetadata() {
    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const groups = await admin.listGroups();
      const groupId = process.env.KAFKA_GROUP_ID || 'alert-group';

      const group = groups.groups.find(g => g.groupId === groupId);

      await admin.disconnect();

      return group;
    } catch (error) {
      logger.error('Failed to get consumer group metadata:', error);
      return null;
    }
  }
}

export const kafkaConsumer = new KafkaConsumer();