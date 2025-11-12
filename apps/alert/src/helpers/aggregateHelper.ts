import { RedisCacheService } from '../services/redisCacheService';
import { AlertManagerService } from '../services/alertManagerService';
import { RegionalAggregateMessage } from '../services/kafkaConsumerService';
import { Config } from '../config/env';
import { createLogger } from '../utils/logger';

const logger = createLogger('aggregate-helper');

export class AggregateHelper {
  private static instance: AggregateHelper;
  private redisService: RedisCacheService;
  private alertManager: AlertManagerService;

  private constructor(redisService: RedisCacheService, alertManager: AlertManagerService) {
    this.redisService = redisService;
    this.alertManager = alertManager;
  }

  static getInstance(redisService?: RedisCacheService, alertManager?: AlertManagerService): AggregateHelper {
    if (!AggregateHelper.instance) {
      if (!redisService || !alertManager) {
        throw new Error('RedisService and AlertManager required for first initialization');
      }
      AggregateHelper.instance = new AggregateHelper(redisService, alertManager);
    }
    return AggregateHelper.instance;
  }

  async processRegionalAggregate(aggregate: RegionalAggregateMessage): Promise<void> {
    try {
      logger.debug(
        { region: aggregate.region, loadPercentage: aggregate.load_percentage },
        'Processing regional aggregate'
      );

      for (const meterId of aggregate.active_meters) {
        await this.redisService.updateMeterLastSeen(meterId, aggregate.region, new Date(aggregate.timestamp));
      }

      await this.redisService.updateRegionLoad(
        aggregate.region,
        aggregate.load_percentage,
        new Date(aggregate.timestamp)
      );

      if (aggregate.load_percentage > Config.alertThresholds.regionalOverloadPercent) {
        await this.checkRegionalOverload(aggregate);
      }

      await this.checkMeterOutages(aggregate);
    } catch (error) {
      logger.error({ error, aggregate }, 'Failed to process regional aggregate');
      throw error;
    }
  }

  private async checkRegionalOverload(aggregate: RegionalAggregateMessage): Promise<void> {
    try {
      const region = aggregate.region;
      const timestamp = new Date(aggregate.timestamp);

      await this.redisService.addOverloadWindow(region, timestamp);

      const windowCount = await this.redisService.getOverloadWindowCount(region, 300000);

      if (windowCount >= Config.alertThresholds.overloadConsecutiveWindows) {
        const hasActiveAlert = await this.redisService.hasActiveAlert(region, 'REGIONAL_OVERLOAD');

        if (!hasActiveAlert) {
          logger.info(
            { region, loadPercentage: aggregate.load_percentage, windowCount },
            'Regional overload detected'
          );

          await this.alertManager.createAlert({
            type: 'REGIONAL_OVERLOAD',
            severity: 'high',
            region: region,
            message: `Regional overload detected: ${aggregate.load_percentage.toFixed(1)}% load for ${windowCount} consecutive time windows`,
            metadata: {
              load_percentage: aggregate.load_percentage,
              meter_count: aggregate.meter_count,
              total_consumption: aggregate.total_consumption,
              window_count: windowCount,
              timestamp: aggregate.timestamp
            }
          });

          await this.redisService.setActiveAlert(region, 'REGIONAL_OVERLOAD');
        }
      }
    } catch (error) {
      logger.error({ error, region: aggregate.region }, 'Failed to check regional overload');
      throw error;
    }
  }

  private async checkMeterOutages(aggregate: RegionalAggregateMessage): Promise<void> {
    try {
      const region = aggregate.region;
      const timestamp = new Date(aggregate.timestamp);
      const outageThreshold = Config.alertThresholds.meterOutageSeconds * 1000;

      const inactiveMeters = await this.redisService.getInactiveMeters(outageThreshold);

      const outagedMeters = inactiveMeters.filter(
        meter => meter.region === region && !aggregate.active_meters.includes(meter.meter_id)
      );

      for (const meter of outagedMeters) {
        const hasActiveAlert = await this.redisService.hasActiveAlert(region, 'METER_OUTAGE', meter.meter_id);

        if (!hasActiveAlert) {

          const outageTime = timestamp.getTime() - meter.last_seen.getTime();
          logger.info({ meterId: meter.meter_id, region: meter.region, outageTimeMs: outageTime }, 'Meter outage detected');

          await this.alertManager.createAlert({
            type: 'METER_OUTAGE',
            severity: 'medium',
            region: meter.region,
            meter_id: meter.meter_id,
            message: `Meter outage detected: No data received for ${Math.round(outageTime / 1000)} seconds`,
            metadata: {
              last_seen: meter.last_seen.toISOString(),
              outage_duration_ms: outageTime,
              detection_timestamp: timestamp.toISOString()
            }
          });

          await this.redisService.setActiveAlert(region, 'METER_OUTAGE', meter.meter_id);
        }
      }
    } catch (error) {
      logger.error({ error, region: aggregate.region }, 'Failed to check meter outages');
      throw error;
    }
  }
}
