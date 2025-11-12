import { WebSocketService } from '../services/webSocketService';
import { ProcessedAlertMessage, AlertStatusUpdateMessage, TariffUpdateMessage } from '../services/kafkaConsumerService';
import { createLogger } from '../utils/logger';

const logger = createLogger('notification-helper');

export class NotificationHelper {
  private static instance: NotificationHelper;
  private wsService: WebSocketService;

  private constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  static getInstance(wsService?: WebSocketService): NotificationHelper {
    if (!NotificationHelper.instance) {
      if (!wsService) throw new Error('WebSocketService required for first initialization');
      NotificationHelper.instance = new NotificationHelper(wsService);
    }
    return NotificationHelper.instance;
  }

  async handleProcessedAlert(alert: ProcessedAlertMessage): Promise<void> {
    try {
      logger.info({
        id: alert.id, type: alert.type, severity: alert.severity, region: alert.region, status: alert.status
      }, 'Handling processed alert');

      // ? Broadcast to alerts channel (operators/admins only)
      this.wsService.broadcast('alerts', { type: 'ALERT', payload: alert });

      // ? Broadcast to region-specific channel if region is present
      if (alert.region)
        this.wsService.broadcast(`region:${alert.region}`, { type: 'ALERT', payload: alert });

      // ?Broadcast to meter-specific channel if meter_id is present
      if (alert.meter_id)
        this.wsService.broadcast(`meter:${alert.meter_id}`, { type: 'ALERT', payload: alert });

      logger.debug({ alertId: alert.id }, 'Alert notification broadcast complete');
    } catch (error) {
      logger.error({ error, alert }, 'Failed to handle processed alert');
      throw error;
    }
  }

  async handleAlertStatusUpdate(update: AlertStatusUpdateMessage): Promise<void> {
    try {
      logger.info({ alertId: update.alert_id, status: update.status }, 'Handling alert status update');

      // ?  Broadcast to alert_status_updates channel (operators/admins only)
      this.wsService.broadcast('alert_status_updates', { type: 'ALERT_STATUS_UPDATE', payload: update });

      // ? Also broadcast to alerts channel for real-time status changes
      this.wsService.broadcast('alerts', { type: 'ALERT_STATUS_UPDATE', payload: update });

      // ? If metadata contains region, also broadcast to region channel
      if (update.metadata && update.metadata.region)
        this.wsService.broadcast(`region:${update.metadata.region}`, { type: 'ALERT_STATUS_UPDATE', payload: update });

      logger.debug({ alertId: update.alert_id }, 'Alert status update broadcast complete');
    } catch (error) {
      logger.error({ error, update }, 'Failed to handle alert status update');
      throw error;
    }
  }

  async handleTariffUpdate(tariff: TariffUpdateMessage): Promise<void> {
    try {
      logger.info({ tariffId: tariff.tariffId, region: tariff.region, pricePerKwh: tariff.pricePerKwh, triggeredBy: tariff.triggeredBy }, 'Handling tariff update');

      // ? Broadcast to tariffs channel (all users)
      this.wsService.broadcast('tariffs', { type: 'TARIFF_UPDATE', payload: tariff });

      // ? Broadcast to region-specific channel
      this.wsService.broadcast(`region:${tariff.region}`, { type: 'TARIFF_UPDATE', payload: tariff });

      logger.debug({ tariffId: tariff.tariffId, region: tariff.region }, 'Tariff update broadcast complete');
    } catch (error) {
      logger.error({ error, tariff }, 'Failed to handle tariff update');
      throw error;
    }
  }
}
