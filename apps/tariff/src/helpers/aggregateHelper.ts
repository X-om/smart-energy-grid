import { createLogger } from '../utils/logger.js';
import type { RegionalAggregate } from '../services/kafkaConsumerService.js';
import { PostgresService } from '../services/postgresService.js';
import { RedisCacheService } from '../services/redisCacheService.js';
import { KafkaProducerService } from '../services/kafkaProducerService.js';
import { TariffCalculatorService } from '../services/tariffCalculatorService.js';
import { kafkaMessagesConsumed, kafkaMessagesPublished, tariffUpdatesTotal, updateCurrentPrice, tariffCalcLatency, dbOperationLatency } from '../metrics/metrics.js';
import { config } from '../config/env.js';

const logger = createLogger('aggregate-helper');

export const handleAggregate = async (aggregate: RegionalAggregate): Promise<void> => {
  try {
    const startTime = Date.now();
    kafkaMessagesConsumed.inc({ topic: config.kafka.topicInput });

    const calculator = TariffCalculatorService.getInstance();
    const tariffUpdate = calculator.calculateTariff(aggregate);

    const calcDuration = Date.now() - startTime;
    tariffCalcLatency.observe({ region: aggregate.region }, calcDuration);

    if (!tariffUpdate) return;

    const db = PostgresService.getInstance();
    const cache = RedisCacheService.getInstance();
    const kafkaProducer = KafkaProducerService.getInstance();

    const dbStartTime = Date.now();
    await db.insertTariff({
      tariffId: tariffUpdate.tariffId, region: tariffUpdate.region, pricePerKwh: tariffUpdate.pricePerKwh,
      effectiveFrom: new Date(tariffUpdate.effectiveFrom),
      reason: tariffUpdate.reason, triggeredBy: tariffUpdate.triggeredBy
    });
    const dbDuration = Date.now() - dbStartTime;
    dbOperationLatency.observe({ operation: 'insert' }, dbDuration);

    await cache.setTariff(tariffUpdate.region, tariffUpdate.pricePerKwh);
    await kafkaProducer.publishTariffUpdate(tariffUpdate, config.kafka.topicOutput);

    kafkaMessagesPublished.inc({ topic: config.kafka.topicOutput });
    tariffUpdatesTotal.inc({ region: tariffUpdate.region, triggered_by: tariffUpdate.triggeredBy });
    updateCurrentPrice(tariffUpdate.region, tariffUpdate.pricePerKwh);

    logger.info({ region: tariffUpdate.region, oldPrice: tariffUpdate.oldPrice, newPrice: tariffUpdate.pricePerKwh, reason: tariffUpdate.reason }, 'Tariff update processed');
  } catch (error) {
    logger.error({ error, aggregate }, 'Error processing aggregate');
  }
};
