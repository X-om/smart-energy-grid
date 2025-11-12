import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.routes';
import telemetryRouter from './routes/telemetry.routes';
import tariffRouter from './routes/tariff.routes';
import alertRouter from './routes/alert.routes';
import billingRouter from './routes/billing.routes';
import adminRouter from './routes/adminRouter';
import operatorRouter from './routes/operatorRouter';

import { logger } from './utils/logger';
import { connectDatabases, disconnectDatabases } from './utils/db';
import { connectKafka, disconnectKafka } from './services/kafka/lifecycle';
import { env } from './config/env';
import { healthController } from './helpers/healthController';
import { metricsController } from './helpers/metricsController';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import userRouter from './routes/userRouter';

const app = express();

app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN }));

app.get('/health', healthController);
app.get('/metrics', metricsController);

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/telemetry', telemetryRouter);
app.use('/api/v1/tariff', tariffRouter);
app.use('/api/v1/alerts', alertRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/operator', operatorRouter);
app.use('/api/v1/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    logger.info('Starting API Gateway...');

    await connectDatabases();
    await connectKafka();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 API Gateway started on port ${env.PORT}`);
      logger.info(`📚 Health: http://localhost:${env.PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${env.PORT}/metrics`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);
      server.close(async () => {
        await disconnectKafka();
        await disconnectDatabases();
        process.exit(0);
      });
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
