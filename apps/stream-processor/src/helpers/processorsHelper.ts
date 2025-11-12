import type { TelemetryReading } from '@segs/shared-types';
import { AggregatorService } from '../services/aggregator';
import { AnomalyDetectorService } from '../services/anomalyDetector';
import { KafkaProducerService } from '../kafka/producer';
import { calculateLagSeconds } from '../utils/time';
import { createLogger } from '../utils/logger';
import { streamMessagesTotal, streamAnomaliesDetectedTotal, streamAlertsPublishedTotal, streamLagSeconds } from '../metrics/metrics';
import { config } from '../config/env';

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
