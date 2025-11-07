/**
 * Express Server Setup
 * 
 * Configures Express application with:
 * - Middleware (JSON parsing, logging, compression)
 * - Routes (telemetry, health, metrics)
 * - Error handling
 */

import express, { Request, Response, NextFunction, Application } from 'express';
import { createTelemetryRouter, TelemetryRouterDeps } from './routes/telemetry.js';
import { register } from './metrics/metrics.js';
import { httpRequestsTotal, httpRequestDuration, redisConnectionStatus, kafkaConnectionStatus, } from './metrics/metrics.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('server');

export interface ServerDeps extends TelemetryRouterDeps {
  // Additional dependencies can be added here
}

/**
 * Create and configure Express application
 */
export function createServer(deps: ServerDeps): Application {
  const app = express();

  // Trust proxy for correct client IP in load balancer scenarios
  app.set('trust proxy', true);

  // Middleware - JSON body parser
  app.use(express.json({ limit: '10mb' }));

  // Middleware - Request logging and metrics
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log request
    logger.debug(
      {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      'Incoming request'
    );

    // Capture response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const endpoint = req.route?.path || req.path;

      // Update metrics
      httpRequestsTotal.inc({
        method: req.method,
        endpoint,
        status: res.statusCode.toString(),
      });

      httpRequestDuration.observe(
        {
          method: req.method,
          endpoint,
          status: res.statusCode.toString(),
        },
        duration
      );

      // Log response
      const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel](
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          ip: req.ip,
        },
        'Request completed'
      );
    });

    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const health = {
      status: 'ok',
      service: 'ingestion',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connections: {
        redis: deps.dedupeService.isConnected(),
        kafka: deps.kafkaProducer.isConnected(),
      },
    };

    const isHealthy = health.connections.redis && health.connections.kafka;
    res.status(isHealthy ? 200 : 503).json(health);
  });

  // Metrics endpoint (Prometheus)
  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      // Update connection status metrics
      redisConnectionStatus.set(deps.dedupeService.isConnected() ? 1 : 0);
      kafkaConnectionStatus.set(deps.kafkaProducer.isConnected() ? 1 : 0);

      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error({ error }, 'Error generating metrics');
      res.status(500).json({ status: 'error', message: 'Failed to generate metrics' });
    }
  });

  // Mount telemetry routes
  app.use(createTelemetryRouter(deps));

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Not found',
      path: req.path,
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error(
      {
        error: err,
        method: req.method,
        path: req.path,
        ip: req.ip,
      },
      'Unhandled error'
    );

    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  });

  return app;
}
