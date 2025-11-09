import { Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';
import { register, dbConnectionPoolSize, updateUptime } from '../metrics/metrics.js';
import { PostgresService } from '../services/postgresService.js';

const logger = createLogger('metrics-controller');

export const tariffMetricsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = PostgresService.getInstance();
    const poolStats = db.getStats();
    dbConnectionPoolSize.set({ state: 'total' }, poolStats.total);
    dbConnectionPoolSize.set({ state: 'idle' }, poolStats.idle);
    dbConnectionPoolSize.set({ state: 'waiting' }, poolStats.waiting);

    updateUptime();

    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error({ error }, 'Error generating metrics');
    res.status(500).end('Error generating metrics');
  }
};
