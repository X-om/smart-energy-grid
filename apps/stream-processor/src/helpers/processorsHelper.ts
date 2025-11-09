import type { TelemetryReading } from '@segs/shared-types';
import { AggregatorService } from '../services/aggregator.js';
import { AnomalyDetectorService } from '../services/anomalyDetector.js';
import { KafkaProducerService } from '../kafka/producer.js';
import { calculateLagSeconds } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';
import { streamMessagesTotal, streamAnomaliesDetectedTotal, streamAlertsPublishedTotal, streamLagSeconds } from '../metrics/metrics.js';
import { config } from '../config/env.js';

const logger = createLogger('processors-helper');

export const handleReading = async (reading: TelemetryReading): Promise<void> => {
  try {
    const startTime = Date.now();
    streamMessagesTotal.inc({ topic: config.kafka.topicInput });

    const lag = calculateLagSeconds(reading.timestamp);
    streamLagSeconds.set(lag);

    const aggregator = AggregatorService.getInstance();
    aggregator.processReading(reading);

    const anomalyDetector = AnomalyDetectorService.getInstance();
    // ! CRITICAL : every alert type is ANOMALY for now
    const alert = await anomalyDetector.checkReading(reading);

    if (alert) {
      const kafkaProducer = KafkaProducerService.getInstance();
      const published = await kafkaProducer.publishAlert(alert, config.kafka.topicAlerts);

      if (published) {
        streamAnomaliesDetectedTotal.inc({ type: alert.type, severity: alert.severity });
        streamAlertsPublishedTotal.inc();
      }
    }
    const duration = Date.now() - startTime;
    logger.debug({ meterId: reading.meterId, powerKw: reading.powerKw, duration }, 'Reading processed');
  } catch (error) {
    logger.error({ error, reading }, 'Error handling reading');
  }
};
