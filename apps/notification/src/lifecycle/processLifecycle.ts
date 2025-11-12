import express, { Application } from 'express';
import { Server } from 'http';
import { createLogger } from '../utils/logger';
import { Config } from '../config/env';
import { AlertStatusUpdateMessage, BillingUpdateMessage, DisputeUpdateMessage, KafkaConsumerService, PaymentUpdateMessage, ProcessedAlertMessage, TariffUpdateMessage } from '../services/kafkaConsumerService';
import { WebSocketService } from '../services/webSocketService';
import { NotificationHelper } from '../helpers/notificationHelper';
import { getHealth, getClients } from '../controllers/healthController';

const logger = createLogger('lifecycle');

let server: Server;

export const initialize = async (): Promise<void> => {
  logger.info('Initializing Notification Service...');

  const kafkaConsumer = KafkaConsumerService.getInstance({
    brokers: Config.kafka.brokers, clientId: Config.kafka.clientId,
    groupId: Config.kafka.groupId, topics: [
      Config.kafka.topicAlertsProcessed,
      Config.kafka.topicAlertStatusUpdates,
      Config.kafka.topicTariffUpdates,
      Config.kafka.topicBillingUpdates,
      Config.kafka.topicPaymentUpdates,
      Config.kafka.topicDisputeUpdates
    ]
  });
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe();

  logger.info('Kafka consumer connected and subscribed');
  logger.info('All services initialized successfully');
};

export const startProcessing = async (): Promise<void> => {
  const kafkaConsumer = KafkaConsumerService.getInstance();
  const wsService = WebSocketService.getInstance();
  const notificationHelper = NotificationHelper.getInstance(wsService);

  kafkaConsumer.setMessageHandler(async (topic: string, message: unknown) => {
    if (topic === Config.kafka.topicAlertsProcessed)
      await notificationHelper.handleProcessedAlert(message as ProcessedAlertMessage);

    else if (topic === Config.kafka.topicAlertStatusUpdates)
      await notificationHelper.handleAlertStatusUpdate(message as AlertStatusUpdateMessage);

    else if (topic === Config.kafka.topicTariffUpdates)
      await notificationHelper.handleTariffUpdate(message as TariffUpdateMessage);

    else if (topic === Config.kafka.topicBillingUpdates)
      await notificationHelper.handleBillingUpdate(message as BillingUpdateMessage);

    else if (topic === Config.kafka.topicPaymentUpdates)
      await notificationHelper.handlePaymentUpdate(message as PaymentUpdateMessage);

    else if (topic === Config.kafka.topicDisputeUpdates)
      await notificationHelper.handleDisputeUpdate(message as DisputeUpdateMessage);
  });

  await kafkaConsumer.startConsuming();
  logger.info('Started consuming from Kafka topics');
};

export const createApp = (): Application => {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug({ method: req.method, path: req.path, status: res.statusCode, duration }, 'API request');
    }); next();
  });

  app.get('/health', getHealth);
  app.get('/clients', getClients);

  app.use('*', (req, res) => {
    res.status(404).json({
      success: false, error: 'Endpoint not found',
      message: `The endpoint ${req.method} ${req.originalUrl} does not exist`
    });
  });
  return app;
};

export const startServer = async (httpServer: Server): Promise<void> => {
  const wsService = WebSocketService.getInstance();
  wsService.initialize(httpServer);

  return new Promise<void>((resolve) => {
    server = httpServer;
    server.listen(Config.server.port, () => {
      logger.info({ port: Config.server.port }, 'API server started');
      resolve();
    });
  });
};

export const shutdown = async (signal: string): Promise<void> => {
  try {
    logger.info({ signal }, 'Shutdown signal received');

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      logger.info('API server closed');
    }

    const wsService = WebSocketService.getInstance();
    await wsService.shutdown();
    logger.info('WebSocket server closed');

    const kafkaConsumer = KafkaConsumerService.getInstance();
    await kafkaConsumer.disconnect();
    logger.info('Kafka consumer disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};
