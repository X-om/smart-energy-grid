import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const register = new Registry();

register.setDefaultLabels({ service: 'tariff' });

export const tariffUpdatesTotal = new Counter({
  name: 'tariff_updates_total',
  help: 'Total number of tariff updates',
  labelNames: ['region', 'triggered_by'],
  registers: [register],
});

export const tariffOverridesTotal = new Counter({
  name: 'tariff_overrides_total',
  help: 'Total number of manual tariff overrides',
  labelNames: ['region', 'operator'],
  registers: [register],
});

export const kafkaMessagesConsumed = new Counter({
  name: 'tariff_kafka_messages_consumed_total',
  help: 'Total number of Kafka messages consumed',
  labelNames: ['topic'],
  registers: [register],
});

export const kafkaMessagesPublished = new Counter({
  name: 'tariff_kafka_messages_published_total',
  help: 'Total number of Kafka messages published',
  labelNames: ['topic'],
  registers: [register],
});

export const dbOperationsTotal = new Counter({
  name: 'tariff_db_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const tariffCurrentPrice = new Gauge({
  name: 'tariff_current_price',
  help: 'Current tariff price per kWh for each region',
  labelNames: ['region'],
  registers: [register],
});

export const kafkaConsumerConnected = new Gauge({
  name: 'tariff_kafka_consumer_connected',
  help: 'Kafka consumer connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const kafkaProducerConnected = new Gauge({
  name: 'tariff_kafka_producer_connected',
  help: 'Kafka producer connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const postgresConnected = new Gauge({
  name: 'tariff_postgres_connected',
  help: 'PostgreSQL connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const redisConnected = new Gauge({
  name: 'tariff_redis_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const dbConnectionPoolSize = new Gauge({
  name: 'tariff_db_connection_pool_size',
  help: 'Database connection pool size',
  labelNames: ['state'],
  registers: [register],
});

export const serviceUptime = new Gauge({
  name: 'tariff_service_uptime_seconds',
  help: 'Service uptime in seconds',
  registers: [register],
});

export const tariffCalcLatency = new Histogram({
  name: 'tariff_calc_latency_ms',
  help: 'Tariff calculation latency in milliseconds',
  labelNames: ['region'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register],
});

export const dbOperationLatency = new Histogram({
  name: 'tariff_db_operation_latency_ms',
  help: 'Database operation latency in milliseconds',
  labelNames: ['operation'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

export const apiRequestDuration = new Histogram({
  name: 'tariff_api_request_duration_ms',
  help: 'API request duration in milliseconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

const startTime = Date.now();

export const updateUptime = () => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  serviceUptime.set(uptimeSeconds);
}

setInterval(updateUptime, 10000);
export const updateCurrentPrice = (region: string, price: number) => tariffCurrentPrice.set({ region }, price);

export const updateAllPrices = (priceMap: Map<string, number>) => {
  for (const [region, price] of priceMap.entries())
    tariffCurrentPrice.set({ region }, price);
}
