import http from 'http';
import { AggregatorService } from '../services/aggregator.js';
import { TimescaleDBService } from '../db/timescale.js';
import { KafkaConsumerService } from '../kafka/consumer.js';
import { KafkaProducerService } from '../kafka/producer.js';
import { createLogger } from '../utils/logger.js';
import { register, streamWindowBucketsGauge, streamWindowedReadingsGauge, dbConnectionPoolSize, updateUptime } from '../metrics/metrics.js';
import { config } from '../config/env.js';

const logger = createLogger('metrics-controller');

export const updateMetrics = (): void => {
  const aggregator = AggregatorService.getInstance();
  const stats = aggregator.getStats();

  streamWindowBucketsGauge.set({ window_type: '1m' }, stats.windows1m.buckets);
  streamWindowBucketsGauge.set({ window_type: '15m' }, stats.windows15m.buckets);
  streamWindowedReadingsGauge.set({ window_type: '1m' }, stats.windows1m.readings);
  streamWindowedReadingsGauge.set({ window_type: '15m' }, stats.windows15m.readings);

  const db = TimescaleDBService.getInstance();
  const poolStats = db.getStats();

  dbConnectionPoolSize.set({ state: 'total' }, poolStats.total);
  dbConnectionPoolSize.set({ state: 'idle' }, poolStats.idle);
  dbConnectionPoolSize.set({ state: 'waiting' }, poolStats.waiting);

  updateUptime();
};

export const startMetricsServer = (): http.Server => {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        updateMetrics();
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error({ error }, 'Error generating metrics');
        res.statusCode = 500;
        res.end('Error generating metrics');
      }
    } else if (req.url === '/health') {
      const kafkaConsumer = KafkaConsumerService.getInstance();
      const kafkaProducer = KafkaProducerService.getInstance();
      const db = TimescaleDBService.getInstance();

      const health = {
        status: 'ok',
        service: 'stream-processor',
        timestamp: new Date().toISOString(),
        connections: {
          kafka: kafkaConsumer.isConnected() && kafkaProducer.isConnected(),
          timescaledb: db.isConnected(),
        },
      };

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(health));
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Metrics server started');
  });

  return server;
};
