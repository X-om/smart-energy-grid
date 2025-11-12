import { WebSocketService } from '../services/webSocketService';
import { ProcessedAlertMessage, AlertStatusUpdateMessage, TariffUpdateMessage, BillingUpdateMessage, PaymentUpdateMessage, DisputeUpdateMessage } from '../services/kafkaConsumerService';
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

  async handleBillingUpdate(billing: BillingUpdateMessage): Promise<void> {
    try {
      logger.info({
        invoiceId: billing.invoice_id, userId: billing.user_id, region: billing.region, status: billing.status
      }, 'Handling billing update');

      // Broadcast to billing channel (all users)
      this.wsService.broadcast('billing', { type: 'BILLING_UPDATE', payload: billing });

      // Broadcast to invoices channel
      this.wsService.broadcast('invoices', { type: 'BILLING_UPDATE', payload: billing });

      // Broadcast to specific user's channel if they have a WebSocket connection
      this.wsService.broadcast(`user:${billing.user_id}`, { type: 'BILLING_UPDATE', payload: billing });

      // Broadcast to region-specific channel
      this.wsService.broadcast(`region:${billing.region}`, { type: 'BILLING_UPDATE', payload: billing });

      logger.debug({ invoiceId: billing.invoice_id }, 'Billing update broadcast complete');
    } catch (error) {
      logger.error({ error, billing }, 'Failed to handle billing update');
      throw error;
    }
  }

  async handlePaymentUpdate(payment: PaymentUpdateMessage): Promise<void> {
    try {
      logger.info({
        transactionId: payment.transaction_id, invoiceId: payment.invoice_id, userId: payment.user_id, status: payment.status
      }, 'Handling payment update');

      // Broadcast to payments channel
      this.wsService.broadcast('payments', { type: 'PAYMENT_UPDATE', payload: payment });

      // Broadcast to billing channel
      this.wsService.broadcast('billing', { type: 'PAYMENT_UPDATE', payload: payment });

      // Broadcast to specific user's channel
      this.wsService.broadcast(`user:${payment.user_id}`, { type: 'PAYMENT_UPDATE', payload: payment });

      logger.debug({ transactionId: payment.transaction_id }, 'Payment update broadcast complete');
    } catch (error) {
      logger.error({ error, payment }, 'Failed to handle payment update');
      throw error;
    }
  }

  async handleDisputeUpdate(dispute: DisputeUpdateMessage): Promise<void> {
    try {
      logger.info({
        disputeId: dispute.dispute_id, invoiceId: dispute.invoice_id, userId: dispute.user_id, status: dispute.status
      }, 'Handling dispute update');

      // Broadcast to disputes channel (operators/admins)
      this.wsService.broadcast('disputes', { type: 'DISPUTE_UPDATE', payload: dispute });

      // Broadcast to billing channel
      this.wsService.broadcast('billing', { type: 'DISPUTE_UPDATE', payload: dispute });

      // Broadcast to specific user's channel
      this.wsService.broadcast(`user:${dispute.user_id}`, { type: 'DISPUTE_UPDATE', payload: dispute });

      logger.debug({ disputeId: dispute.dispute_id }, 'Dispute update broadcast complete');
    } catch (error) {
      logger.error({ error, dispute }, 'Failed to handle dispute update');
      throw error;
    }
  }
}
