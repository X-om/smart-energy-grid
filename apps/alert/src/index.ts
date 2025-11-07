import 'dotenv/config';
import express, { Application } from 'express';
import { postgresService } from './db/postgres.js';
import { redisService } from './services/redis.js';
import { kafkaConsumer } from './kafka/consumer.js';
import { kafkaProducer } from './kafka/producer.js';
import { metricsService } from './metrics/metrics.js';
import operatorRoutes from './routes/operator.js';
import { logger } from './utils/logger.js';

const app: Application = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Record metrics
    metricsService.incrementHttpRequests(req.method, req.path, res.statusCode);
    metricsService.recordHttpRequestDuration(req.method, req.path, duration);

    logger.info('HTTP request processed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });

  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'alert-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      postgres: true, // Will be updated by connection monitoring
      redis: redisService.isHealthy(),
      kafka_consumer: kafkaConsumer.isHealthy(),
      kafka_producer: kafkaProducer.isHealthy()
    }
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
    logger.error('Failed to serve metrics:', error);
    res.status(500).send('Failed to retrieve metrics');
  }
});

// API routes
app.use('/operator', operatorRoutes);

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
  logger.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Make server available globally for shutdown
let httpServer: any;

// Connection monitoring function
const monitorConnections = async () => {
  try {
    // Update connection status metrics
    metricsService.updateConnectionStatuses(
      kafkaConsumer.isHealthy() && kafkaProducer.isHealthy(),
      true, // PostgreSQL - would need to implement health check
      redisService.isHealthy()
    );

  } catch (error) {
    logger.error('Connection monitoring error:', error);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new requests
    if (httpServer) {
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Disconnect from services
    await Promise.all([
      kafkaConsumer.disconnect(),
      kafkaProducer.disconnect(),
      redisService.disconnect(),
      postgresService.disconnect()
    ]);

    logger.info('All connections closed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Startup function
const startServer = async () => {
  try {
    logger.info('Starting Alert Service...');

    // Connect to PostgreSQL and run migrations
    logger.info('Connecting to PostgreSQL...');
    await postgresService.connect();

    // Run migrations if needed (skip if already applied)
    try {
      await postgresService.runMigrations();
    } catch (error) {
      logger.warn('Migrations may already be applied, continuing...', { error: error instanceof Error ? error.message : String(error) });
    }

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await redisService.connect();

    // Connect to Kafka
    logger.info('Connecting to Kafka...');
    await kafkaProducer.connect();
    await kafkaConsumer.connect();

    // Start Kafka consumer
    logger.info('Starting Kafka message consumption...');
    await kafkaConsumer.startConsuming();

    // Start connection monitoring
    setInterval(monitorConnections, 30000); // Monitor every 30 seconds

    // Start HTTP server
    httpServer = app.listen(PORT, () => {
      logger.info(`Alert Service started successfully on port ${PORT}`);
      logger.info('Service endpoints:', {
        health: `http://localhost:${PORT}/health`,
        metrics: `http://localhost:${PORT}/metrics`,
        operator_api: `http://localhost:${PORT}/operator/alerts`
      });
    });

    // Send initial health check message to Kafka
    setTimeout(async () => {
      try {
        await kafkaProducer.publishHealthCheck();
        logger.info('Initial health check published to Kafka');
      } catch (error) {
        logger.error('Failed to publish initial health check:', error);
      }
    }, 5000);

  } catch (error) {
    logger.error('Failed to start Alert Service:', error);
    process.exit(1);
  }
};

// Start the service
startServer().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});

console.log('🚨 [ALERT] Alert Detection Service initialized');

export default app;
