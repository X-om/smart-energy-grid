import 'dotenv/config';
import express, { Application } from 'express';
import { createServer } from 'http';
import { wsServer } from './ws/server.js';
import { kafkaConsumer } from './kafka/consumer.js';
import { metricsService } from './metrics/metrics.js';
import { logger } from './utils/logger.js';

const app: Application = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'notification-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      kafka: kafkaConsumer.isHealthy(),
      websocket: true
    },
    websocket: wsServer.getStats()
  };

  const allHealthy = Object.values(health.connections).every(status => status);

  if (allHealthy) {
    res.json(health);
  } else {
    res.status(503).json({
      ...health,
      status: 'unhealthy'
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to serve metrics', error);
    res.status(500).send('Failed to retrieve metrics');
  }
});

// Clients endpoint (for operator introspection)
app.get('/clients', (_req, res) => {
  const stats = wsServer.getStats();
  res.json({
    success: true,
    data: stats
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          logger.error('Error closing HTTP server', error);
          reject(error);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });

    // Shutdown WebSocket server
    await wsServer.shutdown();

    // Disconnect from Kafka
    await kafkaConsumer.disconnect();

    logger.info('All connections closed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  gracefulShutdown('uncaughtException');
});

// Startup function
const startServer = async () => {
  try {
    logger.info('Starting Notification Service...');

    // Connect to Kafka
    logger.info('Connecting to Kafka...');
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe();

    // Start consuming Kafka messages
    logger.info('Starting Kafka message consumption...');
    await kafkaConsumer.startConsuming();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Notification Service started successfully on port ${PORT}`);
      logger.info('Service endpoints:', {
        health: `http://localhost:${PORT}/health`,
        metrics: `http://localhost:${PORT}/metrics`,
        clients: `http://localhost:${PORT}/clients`,
        websocket: `ws://localhost:${PORT}/ws?token=<JWT>`
      });
    });

    // Initialize WebSocket server
    wsServer.initialize(httpServer);

    logger.info('All services initialized successfully');

  } catch (error) {
    logger.error('Failed to start Notification Service', error);
    process.exit(1);
  }
};

// Start the service
startServer().catch((error) => {
  logger.error('Failed to start service', error);
  process.exit(1);
});

console.log('📡 [NOTIFICATION] Real-time Event Broadcasting Service initialized');

export default app;

