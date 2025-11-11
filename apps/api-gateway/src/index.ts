import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/userRouter.js';
import telemetryRouter from './routes/telemetry.routes.js';
import adminRouter from './routes/adminRouter.js';
import operatorRouter from './routes/operatorRouter.js';

import { logger } from './utils/logger.js';
import { connectDatabases, disconnectDatabases } from './utils/db.js';
import { env } from './config/env.js';
import { healthController } from './helpers/healthController.js';
import { metricsController } from './helpers/metricsController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN }));

app.get('/health', healthController);
app.get('/metrics', metricsController);

// Mount routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/telemetry', telemetryRouter);
app.use('/api/v1/operator', operatorRouter);
app.use('/api/v1/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    logger.info('Starting API Gateway...');

    await connectDatabases();
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 API Gateway started on port ${env.PORT}`);
      logger.info(`📚 Health: http://localhost:${env.PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${env.PORT}/metrics`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      server.close(async () => { await disconnectDatabases(); process.exit(0); });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('Unhandled error in startServer:', error);
  process.exit(1);
});
