import { AlertManagerService } from '../services/alertManagerService';
import { AnomalyAlertMessage } from '../services/kafkaConsumerService';
import { createLogger } from '../utils/logger';

const logger = createLogger('alert-helper');

export class AlertHelper {
  private static instance: AlertHelper;
  private alertManager: AlertManagerService;

  private constructor(alertManager: AlertManagerService) {
    this.alertManager = alertManager;
  }

  static getInstance(alertManager?: AlertManagerService): AlertHelper {
    if (!AlertHelper.instance) {
      if (!alertManager) {
        throw new Error('AlertManager required for first initialization');
      }
      AlertHelper.instance = new AlertHelper(alertManager);
    }
    return AlertHelper.instance;
  }

  async processAnomalyAlert(alertData: AnomalyAlertMessage): Promise<void> {
    try {
      logger.debug(
        { id: alertData.id, type: alertData.type, region: alertData.region },
        'Processing anomaly alert'
      );

      if (alertData.type === 'anomaly') {
        await this.alertManager.createAlert({
          type: alertData.type,
          severity: alertData.severity,
          region: alertData.region,
          meter_id: alertData.meter_id,
          message: alertData.message,
          metadata: {
            ...alertData.metadata,
            source: 'stream-processor',
            original_id: alertData.id
          }
        });
      }
    } catch (error) {
      logger.error({ error, alertData }, 'Failed to process anomaly alert');
      throw error;
    }
  }
}
