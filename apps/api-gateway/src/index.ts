import 'dotenv/config';
import app from './app.js';
import { postgresClient } from './db/postgres.js';
import { timescaleClient } from './db/timescale.js';
import { redisClient } from './db/redis.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 3000;

/**
 * Initialize database connections
 */
async function initializeDatabases(): Promise<void> {
  try {
    logger.info('Initializing database connections...');

    // Connect to PostgreSQL
    await postgresClient.connect();
    logger.info('✓ PostgreSQL connected');

    // Connect to TimescaleDB
    await timescaleClient.connect();
    logger.info('✓ TimescaleDB connected');

    // Connect to Redis
    await redisClient.connect();
    logger.info('✓ Redis connected');

    logger.info('All database connections established');
  } catch (error) {
    logger.error('Failed to initialize databases', error);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close database connections
    await Promise.all([
      postgresClient.disconnect(),
      timescaleClient.disconnect(),
      redisClient.disconnect(),
    ]);

    logger.info('All connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting API Gateway...');

    // Initialize databases
    await initializeDatabases();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 API Gateway started successfully on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/docs`);
      logger.info(`💚 Health Check: http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', { reason, promise });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      gracefulShutdown('uncaughtException');
    });

    return new Promise((resolve) => {
      server.on('listening', () => resolve());
    });
  } catch (error) {
    logger.error('Failed to start API Gateway', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Startup failed', error);
  process.exit(1);
});

console.log('🌐 [API-GATEWAY] API Gateway Service initialized');
