import { PostgresService, Alert, CreateAlertData, UpdateAlertData, AlertFilters } from './postgresService';
import { RedisCacheService } from './redisCacheService';
import { KafkaProducerService, ProcessedAlertMessage } from './kafkaProducerService';
import { createLogger } from '../utils/logger';

const logger = createLogger('alert-manager');

export interface AlertAcknowledgment {
  acknowledged_by: string;
  acknowledged_at: Date;
  note?: string;
}

export interface AlertResolution {
  resolved_by: string;
  resolved_at: Date;
  resolution_note?: string;
}

export interface AlertManagerStats {
  total_alerts: number;
  active_alerts: number;
  acknowledged_alerts: number;
  resolved_alerts: number;
  alerts_by_type: Record<string, number>;
  alerts_by_region: Record<string, number>;
  avg_resolution_time_hours: number;
}

export class AlertManagerService {
  private static instance: AlertManagerService;
  private postgresService: PostgresService;
  private redisService: RedisCacheService;
  private kafkaProducer: KafkaProducerService;
  private alertsProcessedTopic: string;
  private statusUpdatesTopic: string;
  private deduplicationTTL: number;

  private constructor(
    postgresService: PostgresService,
    redisService: RedisCacheService,
    kafkaProducer: KafkaProducerService,
    alertsProcessedTopic: string,
    statusUpdatesTopic: string,
    deduplicationTTL: number
  ) {
    this.postgresService = postgresService;
    this.redisService = redisService;
    this.kafkaProducer = kafkaProducer;
    this.alertsProcessedTopic = alertsProcessedTopic;
    this.statusUpdatesTopic = statusUpdatesTopic;
    this.deduplicationTTL = deduplicationTTL;
  }

  static getInstance(
    postgresService?: PostgresService,
    redisService?: RedisCacheService,
    kafkaProducer?: KafkaProducerService,
    alertsProcessedTopic?: string,
    statusUpdatesTopic?: string,
    deduplicationTTL?: number
  ): AlertManagerService {
    if (!AlertManagerService.instance) {
      if (!postgresService || !redisService || !kafkaProducer || !alertsProcessedTopic || !statusUpdatesTopic || !deduplicationTTL) {
        throw new Error('All dependencies required for first initialization');
      }

      AlertManagerService.instance = new AlertManagerService(
        postgresService,
        redisService,
        kafkaProducer,
        alertsProcessedTopic,
        statusUpdatesTopic,
        deduplicationTTL
      );
    }
    return AlertManagerService.instance;
  }

  async createAlert(alertData: CreateAlertData): Promise<Alert> {
    try {
      if (await this.isDuplicateAlert(alertData)) {
        logger.debug({ type: alertData.type, region: alertData.region }, 'Duplicate alert suppressed');
        throw new Error('Duplicate alert suppressed');
      }

      const alert = await this.postgresService.createAlert(alertData);

      await this.publishAlert(alert);
      await this.setAlertDeduplicationMarker(alert);

      logger.info(
        { alertId: alert.id, type: alert.type, severity: alert.severity, region: alert.region },
        'Alert created successfully'
      );

      return alert;
    } catch (error) {
      logger.error({ error, alertData }, 'Failed to create alert');
      throw error;
    }
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    return await this.postgresService.getAlert(alertId);
  }

  async updateAlert(alertId: string, updateData: UpdateAlertData): Promise<Alert | null> {
    try {
      const alert = await this.postgresService.updateAlert(alertId, updateData);

      if (alert) {
        await this.publishAlertStatusUpdate(alert);
        logger.info({ alertId: alert.id, status: alert.status }, 'Alert updated successfully');
      }

      return alert;
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to update alert');
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgment: AlertAcknowledgment): Promise<Alert | null> {
    try {
      const existingAlert = await this.postgresService.getAlert(alertId);
      if (!existingAlert) {
        throw new Error('Alert not found');
      }

      if (existingAlert.acknowledged) {
        logger.warn({ alertId }, 'Alert already acknowledged');
        return existingAlert;
      }

      const updateData: UpdateAlertData = {
        acknowledged: true,
        acknowledged_by: acknowledgment.acknowledged_by,
        acknowledged_at: acknowledgment.acknowledged_at,
        metadata: {
          ...existingAlert.metadata,
          acknowledgment_note: acknowledgment.note,
          acknowledgment_timestamp: acknowledgment.acknowledged_at.toISOString()
        }
      };

      const alert = await this.updateAlert(alertId, updateData);

      if (alert && alert.region && alert.type) {
        await this.redisService.clearActiveAlert(alert.region, alert.type, alert.meter_id);
      }

      return alert;
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to acknowledge alert');
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolution: AlertResolution): Promise<Alert | null> {
    try {
      const existingAlert = await this.postgresService.getAlert(alertId);
      if (!existingAlert) {
        throw new Error('Alert not found');
      }

      if (existingAlert.status === 'resolved') {
        logger.warn({ alertId }, 'Alert already resolved');
        return existingAlert;
      }

      const updateData: UpdateAlertData = {
        status: 'resolved',
        resolved_at: resolution.resolved_at,
        metadata: {
          ...existingAlert.metadata,
          resolution_note: resolution.resolution_note,
          resolved_by: resolution.resolved_by,
          resolution_timestamp: resolution.resolved_at.toISOString()
        }
      };

      const alert = await this.updateAlert(alertId, updateData);

      if (alert && alert.region && alert.type) {
        await this.redisService.clearActiveAlert(alert.region, alert.type, alert.meter_id);
      }

      return alert;
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to resolve alert');
      throw error;
    }
  }

  async getAlerts(filters: AlertFilters): Promise<{ alerts: Alert[]; total: number }> {
    return await this.postgresService.getAlerts(filters);
  }

  async getActiveAlerts(region?: string): Promise<Alert[]> {
    return await this.postgresService.getActiveAlerts(region);
  }

  async getAlertHistory(filters: AlertFilters): Promise<{ alerts: Alert[]; total: number }> {
    return await this.postgresService.getAlertHistory(filters);
  }

  async bulkResolveAlerts(alertIds: string[], resolution: AlertResolution): Promise<Alert[]> {
    try {
      const resolvedAlerts = await this.postgresService.bulkResolveAlerts(
        alertIds,
        resolution.resolved_by,
        resolution.resolved_at,
        resolution.resolution_note
      );

      for (const alert of resolvedAlerts) {
        if (alert.region && alert.type) {
          await this.redisService.clearActiveAlert(alert.region, alert.type, alert.meter_id);
        }
        await this.publishAlertStatusUpdate(alert);
      }

      logger.info({ count: resolvedAlerts.length }, 'Bulk resolved alerts');
      return resolvedAlerts;
    } catch (error) {
      logger.error({ error }, 'Failed to bulk resolve alerts');
      throw error;
    }
  }

  async getStatistics(region?: string): Promise<AlertManagerStats> {
    return await this.postgresService.getStatistics(region);
  }

  async autoResolveOldAlerts(maxAgeHours: number): Promise<number> {
    try {
      const resolvedCount = await this.postgresService.autoResolveOldAlerts(maxAgeHours);
      logger.info({ count: resolvedCount, maxAgeHours }, 'Auto-resolved old alerts');
      return resolvedCount;
    } catch (error) {
      logger.error({ error }, 'Failed to auto-resolve old alerts');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return await this.postgresService.healthCheck();
  }

  private async isDuplicateAlert(alertData: CreateAlertData): Promise<boolean> {
    const region = alertData.region || 'global';
    return await this.redisService.checkDeduplicationMarker(
      alertData.type,
      region,
      alertData.meter_id
    );
  }

  private async setAlertDeduplicationMarker(alert: Alert): Promise<void> {
    const region = alert.region || 'global';
    await this.redisService.setDeduplicationMarker(
      alert.type,
      region,
      alert.meter_id,
      this.deduplicationTTL
    );
  }

  private async publishAlert(alert: Alert): Promise<void> {
    try {
      const processedAlert: ProcessedAlertMessage = {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        region: alert.region,
        meter_id: alert.meter_id,
        message: alert.message,
        status: alert.status,
        timestamp: alert.timestamp.toISOString(),
        acknowledged: alert.acknowledged,
        acknowledged_by: alert.acknowledged_by,
        acknowledged_at: alert.acknowledged_at?.toISOString(),
        resolved_at: alert.resolved_at?.toISOString(),
        metadata: alert.metadata,
        processing_timestamp: new Date().toISOString(),
        source: 'alert-service'
      };

      await this.kafkaProducer.publishProcessedAlert(this.alertsProcessedTopic, processedAlert);
    } catch (error) {
      logger.error({ error, alertId: alert.id }, 'Failed to publish alert');
      throw error;
    }
  }

  private async publishAlertStatusUpdate(alert: Alert): Promise<void> {
    try {
      await this.kafkaProducer.publishAlertStatusUpdate(
        this.statusUpdatesTopic,
        alert.id,
        alert.status,
        {
          acknowledged: alert.acknowledged,
          acknowledged_by: alert.acknowledged_by,
          resolved_at: alert.resolved_at?.toISOString()
        }
      );
    } catch (error) {
      logger.error({ error, alertId: alert.id }, 'Failed to publish status update');
      throw error;
    }
  }
}
