// import { v4 as uuidv4 } from 'uuid'; // Unused for now
import { postgresService, Alert, CreateAlertData, UpdateAlertData, AlertFilters } from '../db/postgres.js';
import { redisService } from './redis.js';
import { kafkaProducer, ProcessedAlertMessage } from '../kafka/producer.js';
import { alertRulesEngine, RuleEvaluationContext } from './alertRules.js';
import { alertLogger as logger } from '../utils/logger.js';
import { metricsService } from '../metrics/metrics.js';

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

class AlertManager {
  // private processingQueue: Set<string> = new Set(); // For future use

  async createAlert(alertData: CreateAlertData): Promise<Alert> {
    const startTime = Date.now();

    try {
      // Check for deduplication
      if (await this.isDuplicateAlert(alertData)) {
        logger.debug('Duplicate alert suppressed', {
          type: alertData.type,
          region: alertData.region,
          meter_id: alertData.meter_id
        });
        throw new Error('Duplicate alert suppressed');
      }

      // Create alert in database
      const alert = await postgresService.createAlert(alertData);

      // Update metrics
      metricsService.incrementAlertsTotal(alert.type, alert.severity, alert.region);
      metricsService.incrementActiveAlerts(alert.type, alert.region);

      // Publish to Kafka
      await this.publishAlert(alert);

      // Set deduplication marker
      await this.setAlertDeduplicationMarker(alert);

      logger.info('Alert created successfully', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        region: alert.region,
        meter_id: alert.meter_id
      });

      const processingTime = Date.now() - startTime;
      metricsService.recordAlertDetectionLatency(processingTime);

      return alert;

    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    try {
      return await postgresService.getAlert(alertId);
    } catch (error) {
      logger.error(`Failed to get alert ${alertId}:`, error);
      throw error;
    }
  }

  async updateAlert(alertId: string, updateData: UpdateAlertData): Promise<Alert | null> {
    try {
      const alert = await postgresService.updateAlert(alertId, updateData);

      if (alert) {
        // Publish status update
        await this.publishAlertStatusUpdate(alert);

        logger.info('Alert updated successfully', {
          alertId: alert.id,
          status: alert.status,
          acknowledged: alert.acknowledged
        });
      }

      return alert;
    } catch (error) {
      logger.error(`Failed to update alert ${alertId}:`, error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgment: AlertAcknowledgment): Promise<Alert | null> {
    try {
      // Check if alert exists and is active
      const existingAlert = await postgresService.getAlert(alertId);
      if (!existingAlert) {
        throw new Error('Alert not found');
      }

      if (existingAlert.acknowledged) {
        logger.warn('Alert already acknowledged', { alertId });
        return existingAlert;
      }

      // Update alert with acknowledgment
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

      if (alert) {
        // Clear active alert marker in Redis if needed
        if (alert.region && alert.type) {
          await redisService.clearActiveAlert(alert.region, alert.type, alert.meter_id);
        }

        logger.info('Alert acknowledged', {
          alertId: alert.id,
          acknowledgedBy: acknowledgment.acknowledged_by,
          type: alert.type,
          region: alert.region
        });
      }

      return alert;

    } catch (error) {
      logger.error(`Failed to acknowledge alert ${alertId}:`, error);
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolution: AlertResolution): Promise<Alert | null> {
    try {
      // Check if alert exists
      const existingAlert = await postgresService.getAlert(alertId);
      if (!existingAlert) {
        throw new Error('Alert not found');
      }

      if (existingAlert.status === 'resolved') {
        logger.warn('Alert already resolved', { alertId });
        return existingAlert;
      }

      // Update alert with resolution
      const updateData: UpdateAlertData = {
        status: 'resolved',
        resolved_at: resolution.resolved_at,
        metadata: {
          ...existingAlert.metadata,
          resolved_by: resolution.resolved_by,
          resolution_note: resolution.resolution_note,
          resolution_timestamp: resolution.resolved_at.toISOString()
        }
      };

      const alert = await this.updateAlert(alertId, updateData);

      if (alert) {
        // Update metrics
        metricsService.decrementActiveAlerts(alert.type, alert.region);

        // Clear active alert marker in Redis
        if (alert.region && alert.type) {
          await redisService.clearActiveAlert(alert.region, alert.type, alert.meter_id);
        }

        logger.info('Alert resolved', {
          alertId: alert.id,
          resolvedBy: resolution.resolved_by,
          type: alert.type,
          region: alert.region,
          resolutionTimeMs: alert.resolved_at ?
            alert.resolved_at.getTime() - alert.timestamp.getTime() : null
        });
      }

      return alert;

    } catch (error) {
      logger.error(`Failed to resolve alert ${alertId}:`, error);
      throw error;
    }
  }

  async getAlerts(filters: AlertFilters = {}): Promise<{ alerts: Alert[]; total: number }> {
    try {
      return await postgresService.getAlerts(filters);
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      throw error;
    }
  }

  async getActiveAlerts(region?: string): Promise<Alert[]> {
    try {
      const filters: AlertFilters = { status: 'active' };
      if (region) {
        filters.region = region;
      }

      const result = await postgresService.getAlerts(filters);
      return result.alerts;
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      throw error;
    }
  }

  async getAlertHistory(filters: AlertFilters = {}): Promise<{ alerts: Alert[]; total: number }> {
    try {
      // Default to resolved alerts for history
      const historyFilters = {
        ...filters,
        status: filters.status || 'resolved'
      };

      return await postgresService.getAlerts(historyFilters);
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      throw error;
    }
  }

  async processIncomingData(data: any, region?: string, meterId?: string): Promise<void> {
    try {
      const context: RuleEvaluationContext = {
        region,
        meter_id: meterId,
        timestamp: new Date(),
        data
      };

      // Evaluate alert rules
      const ruleResults = await alertRulesEngine.evaluateRules(context);

      // Create alerts for triggered rules
      for (const result of ruleResults) {
        await this.createAlert({
          type: result.rule.type,
          severity: result.rule.severity,
          region: result.context.region,
          meter_id: result.context.meter_id,
          message: result.message,
          metadata: result.metadata
        });
      }

    } catch (error) {
      logger.error('Failed to process incoming data:', error);
      throw error;
    }
  }

  async getStatistics(region?: string): Promise<AlertManagerStats> {
    try {
      const filters: any = {};
      if (region) {
        filters.region = region;
      }

      const [
        totalResult,
        activeResult,
        acknowledgedResult,
        resolvedResult
      ] = await Promise.all([
        postgresService.getAlertCount(filters),
        postgresService.getAlertCount({ ...filters, status: 'active' }),
        postgresService.getAlertCount({ ...filters, acknowledged: true }),
        postgresService.getAlertCount({ ...filters, status: 'resolved' })
      ]);

      // Get alerts by type and region
      const allAlerts = await postgresService.getAlerts({
        ...filters,
        limit: 1000
      });

      const alertsByType = allAlerts.alerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const alertsByRegion = allAlerts.alerts.reduce((acc, alert) => {
        if (alert.region) {
          acc[alert.region] = (acc[alert.region] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Calculate average resolution time
      const resolvedAlerts = allAlerts.alerts.filter(a => a.resolved_at);
      const avgResolutionTimeMs = resolvedAlerts.length > 0
        ? resolvedAlerts.reduce((sum, alert) => {
          const resolutionTime = alert.resolved_at!.getTime() - alert.timestamp.getTime();
          return sum + resolutionTime;
        }, 0) / resolvedAlerts.length
        : 0;

      return {
        total_alerts: totalResult,
        active_alerts: activeResult,
        acknowledged_alerts: acknowledgedResult,
        resolved_alerts: resolvedResult,
        alerts_by_type: alertsByType,
        alerts_by_region: alertsByRegion,
        avg_resolution_time_hours: avgResolutionTimeMs / (1000 * 60 * 60)
      };

    } catch (error) {
      logger.error('Failed to get alert statistics:', error);
      throw error;
    }
  }

  private async isDuplicateAlert(alertData: CreateAlertData): Promise<boolean> {
    try {
      if (!alertData.region || !alertData.type) {
        return false;
      }

      // Check if there's an active alert of the same type in Redis
      const hasActive = await redisService.hasActiveAlert(
        alertData.region,
        alertData.type,
        alertData.meter_id
      );

      return hasActive;

    } catch (error) {
      logger.error('Failed to check duplicate alert:', error);
      return false;
    }
  }

  private async setAlertDeduplicationMarker(alert: Alert): Promise<void> {
    try {
      if (alert.region && alert.type) {
        await redisService.setActiveAlert(
          alert.region,
          alert.type,
          alert.meter_id
        );
      }
    } catch (error) {
      logger.error('Failed to set alert deduplication marker:', error);
      // Don't throw - this is not critical
    }
  }

  private async publishAlert(alert: Alert): Promise<void> {
    try {
      const message: ProcessedAlertMessage = {
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

      await kafkaProducer.publishProcessedAlert(message);

    } catch (error) {
      logger.error('Failed to publish alert to Kafka:', error);
      // Don't throw - database alert creation should succeed even if Kafka fails
    }
  }

  private async publishAlertStatusUpdate(alert: Alert): Promise<void> {
    try {
      await kafkaProducer.publishAlertStatusUpdate(alert.id, alert.status, {
        acknowledged: alert.acknowledged,
        acknowledged_by: alert.acknowledged_by,
        acknowledged_at: alert.acknowledged_at?.toISOString(),
        resolved_at: alert.resolved_at?.toISOString(),
        updated_at: alert.updated_at.toISOString()
      });

    } catch (error) {
      logger.error('Failed to publish alert status update:', error);
      // Don't throw - alert update should succeed even if Kafka fails
    }
  }

  async bulkResolveAlerts(alertIds: string[], resolution: AlertResolution): Promise<Alert[]> {
    const resolvedAlerts: Alert[] = [];

    for (const alertId of alertIds) {
      try {
        const alert = await this.resolveAlert(alertId, resolution);
        if (alert) {
          resolvedAlerts.push(alert);
        }
      } catch (error) {
        logger.error(`Failed to resolve alert ${alertId} in bulk operation:`, error);
      }
    }

    logger.info(`Bulk resolved ${resolvedAlerts.length} out of ${alertIds.length} alerts`);
    return resolvedAlerts;
  }

  async autoResolveOldAlerts(maxAgeHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

      const oldAlerts = await postgresService.getAlerts({
        status: 'active',
        to_date: cutoffTime,
        limit: 100
      });

      const resolution: AlertResolution = {
        resolved_by: 'system-auto-resolve',
        resolved_at: new Date(),
        resolution_note: `Auto-resolved after ${maxAgeHours} hours`
      };

      const alertIds = oldAlerts.alerts.map(a => a.id);
      const resolvedAlerts = await this.bulkResolveAlerts(alertIds, resolution);

      logger.info(`Auto-resolved ${resolvedAlerts.length} old alerts`);
      return resolvedAlerts.length;

    } catch (error) {
      logger.error('Failed to auto-resolve old alerts:', error);
      return 0;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      await postgresService.getAlert('00000000-0000-0000-0000-000000000000');

      // Test Redis connection
      const redisHealthy = redisService.isHealthy();

      // Test Kafka producer connection
      const kafkaHealthy = kafkaProducer.isHealthy();

      return redisHealthy && kafkaHealthy;

    } catch (error) {
      logger.error('Alert manager health check failed:', error);
      return false;
    }
  }
}

export const alertManager = new AlertManager();