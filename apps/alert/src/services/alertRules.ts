import { logger } from '../utils/logger.js';
import { redisService } from './redis.js';

export interface AlertRule {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  conditions: AlertCondition[];
  cooldownMs: number;
}

export interface AlertCondition {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'not_contains';
  value: any;
  aggregation?: 'count' | 'avg' | 'sum' | 'max' | 'min';
  timeWindowMs?: number;
}

export interface RuleEvaluationContext {
  region?: string;
  meter_id?: string;
  timestamp: Date;
  data: Record<string, any>;
}

export interface RuleEvaluationResult {
  triggered: boolean;
  rule: AlertRule;
  context: RuleEvaluationContext;
  message: string;
  metadata: Record<string, any>;
}

class AlertRulesEngine {
  private rules: Map<string, AlertRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Regional Overload Rule
    const regionalOverloadRule: AlertRule = {
      id: 'regional_overload',
      name: 'Regional Overload Detection',
      type: 'REGIONAL_OVERLOAD',
      enabled: true,
      severity: 'high',
      description: 'Detects when regional load exceeds 90% for 2 consecutive time windows',
      conditions: [
        {
          field: 'load_percentage',
          operator: 'gt',
          value: 90
        }
      ],
      cooldownMs: 300000 // 5 minutes
    };

    // Meter Outage Rule
    const meterOutageRule: AlertRule = {
      id: 'meter_outage',
      name: 'Meter Outage Detection',
      type: 'METER_OUTAGE',
      enabled: true,
      severity: 'medium',
      description: 'Detects when a meter has not reported data for more than 30 seconds',
      conditions: [
        {
          field: 'last_seen_ago_ms',
          operator: 'gt',
          value: 30000 // 30 seconds
        }
      ],
      cooldownMs: 60000 // 1 minute
    };

    // Anomaly Forwarding Rule
    const anomalyRule: AlertRule = {
      id: 'anomaly_forward',
      name: 'Anomaly Forwarding',
      type: 'anomaly',
      enabled: true,
      severity: 'medium',
      description: 'Forwards anomaly alerts from stream processor',
      conditions: [],
      cooldownMs: 0 // No cooldown for forwarded alerts
    };

    // High Consumption Rule
    const highConsumptionRule: AlertRule = {
      id: 'high_consumption',
      name: 'High Consumption Detection',
      type: 'HIGH_CONSUMPTION',
      enabled: true,
      severity: 'medium',
      description: 'Detects abnormally high consumption for a meter',
      conditions: [
        {
          field: 'consumption',
          operator: 'gt',
          value: 1000, // kWh
          aggregation: 'avg',
          timeWindowMs: 3600000 // 1 hour
        }
      ],
      cooldownMs: 1800000 // 30 minutes
    };

    // Low Regional Generation Rule
    const lowGenerationRule: AlertRule = {
      id: 'low_generation',
      name: 'Low Regional Generation',
      type: 'LOW_GENERATION',
      enabled: true,
      severity: 'high',
      description: 'Detects when regional generation falls below threshold',
      conditions: [
        {
          field: 'generation_percentage',
          operator: 'lt',
          value: 30
        }
      ],
      cooldownMs: 600000 // 10 minutes
    };

    // Add rules to the map
    this.addRule(regionalOverloadRule);
    this.addRule(meterOutageRule);
    this.addRule(anomalyRule);
    this.addRule(highConsumptionRule);
    this.addRule(lowGenerationRule);

    logger.info(`Initialized ${this.rules.size} default alert rules`);
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.name} (${rule.id})`);
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info(`Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    logger.info(`Updated alert rule: ${ruleId}`);
    return true;
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getEnabledRules(): AlertRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled);
  }

  getRulesByType(type: string): AlertRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.type === type);
  }

  async evaluateRules(context: RuleEvaluationContext): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const enabledRules = this.getEnabledRules();

    for (const rule of enabledRules) {
      try {
        const result = await this.evaluateRule(rule, context);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return results;
  }

  async evaluateRule(rule: AlertRule, context: RuleEvaluationContext): Promise<RuleEvaluationResult | null> {
    try {
      // Check cooldown
      if (await this.isInCooldown(rule, context)) {
        logger.debug(`Rule ${rule.id} is in cooldown`, {
          region: context.region,
          meter_id: context.meter_id
        });
        return null;
      }

      // Evaluate conditions
      const conditionResults = await this.evaluateConditions(rule.conditions, context);
      const allConditionsMet = conditionResults.every(result => result);

      if (!allConditionsMet) {
        return null;
      }

      // Generate alert message
      const message = this.generateAlertMessage(rule, context);
      const metadata = this.generateAlertMetadata(rule, context);

      // Set cooldown
      await this.setCooldown(rule, context);

      logger.info(`Rule triggered: ${rule.name}`, {
        ruleId: rule.id,
        region: context.region,
        meter_id: context.meter_id
      });

      return {
        triggered: true,
        rule,
        context,
        message,
        metadata
      };

    } catch (error) {
      logger.error(`Failed to evaluate rule ${rule.id}:`, error);
      return null;
    }
  }

  private async evaluateConditions(conditions: AlertCondition[], context: RuleEvaluationContext): Promise<boolean[]> {
    const results: boolean[] = [];

    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      results.push(result);
    }

    return results;
  }

  private async evaluateCondition(condition: AlertCondition, context: RuleEvaluationContext): Promise<boolean> {
    try {
      let value = this.getValueFromContext(condition.field, context);

      // Apply aggregation if specified
      if (condition.aggregation && condition.timeWindowMs) {
        value = await this.applyAggregation(
          condition.field,
          condition.aggregation,
          condition.timeWindowMs,
          context
        );
      }

      return this.compareValues(value, condition.operator, condition.value);

    } catch (error) {
      logger.error('Failed to evaluate condition:', error);
      return false;
    }
  }

  private getValueFromContext(field: string, context: RuleEvaluationContext): any {
    // Handle nested field access with dot notation
    const fieldParts = field.split('.');
    let value: any = context.data;

    for (const part of fieldParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    // Handle special computed fields
    if (field === 'last_seen_ago_ms' && context.meter_id) {
      // This would be computed based on Redis last_seen data
      return this.computeLastSeenAgo(context.meter_id, context.timestamp);
    }

    return value;
  }

  private async computeLastSeenAgo(meterId: string, currentTime: Date): Promise<number> {
    try {
      const lastSeen = await redisService.getMeterLastSeen(meterId);
      if (!lastSeen) {
        return Infinity; // Meter never seen
      }
      return currentTime.getTime() - lastSeen.last_seen.getTime();
    } catch (error) {
      logger.error(`Failed to compute last seen for meter ${meterId}:`, error);
      return 0;
    }
  }

  private async applyAggregation(
    field: string,
    aggregation: string,
    _timeWindowMs: number,
    context: RuleEvaluationContext
  ): Promise<number> {
    // This is a simplified implementation
    // In a real system, you might query historical data from a time-series database

    switch (aggregation) {
      case 'count':
        return 1; // Placeholder
      case 'avg':
      case 'sum':
      case 'max':
      case 'min':
        return this.getValueFromContext(field, context) || 0;
      default:
        return 0;
    }
  }

  private compareValues(value: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'gt':
        return value > expectedValue;
      case 'gte':
        return value >= expectedValue;
      case 'lt':
        return value < expectedValue;
      case 'lte':
        return value <= expectedValue;
      case 'eq':
        return value === expectedValue;
      case 'neq':
        return value !== expectedValue;
      case 'contains':
        return typeof value === 'string' && value.includes(expectedValue);
      case 'not_contains':
        return typeof value === 'string' && !value.includes(expectedValue);
      default:
        return false;
    }
  }

  private async isInCooldown(rule: AlertRule, context: RuleEvaluationContext): Promise<boolean> {
    if (rule.cooldownMs === 0) {
      return false;
    }

    try {
      const cooldownKey = this.getCooldownKey(rule, context);
      const cooldownData = await redisService.get(cooldownKey);

      if (!cooldownData) {
        return false;
      }

      const cooldownTime = new Date(cooldownData);
      const now = context.timestamp;

      return now.getTime() < cooldownTime.getTime();

    } catch (error) {
      logger.error('Failed to check cooldown:', error);
      return false;
    }
  }

  private async setCooldown(rule: AlertRule, context: RuleEvaluationContext): Promise<void> {
    if (rule.cooldownMs === 0) {
      return;
    }

    try {
      const cooldownKey = this.getCooldownKey(rule, context);
      const cooldownUntil = new Date(context.timestamp.getTime() + rule.cooldownMs);

      await redisService.set(
        cooldownKey,
        cooldownUntil.toISOString(),
        Math.ceil(rule.cooldownMs / 1000)
      );

    } catch (error) {
      logger.error('Failed to set cooldown:', error);
    }
  }

  private getCooldownKey(rule: AlertRule, context: RuleEvaluationContext): string {
    const parts = ['cooldown', rule.id];

    if (context.region) {
      parts.push('region', context.region);
    }

    if (context.meter_id) {
      parts.push('meter', context.meter_id);
    }

    return parts.join(':');
  }

  private generateAlertMessage(rule: AlertRule, context: RuleEvaluationContext): string {
    const baseMessage = rule.description;

    let message = baseMessage;

    if (context.region) {
      message += ` in region ${context.region}`;
    }

    if (context.meter_id) {
      message += ` for meter ${context.meter_id}`;
    }

    // Add specific details based on rule type
    switch (rule.type) {
      case 'REGIONAL_OVERLOAD':
        const load = context.data.load_percentage;
        if (load) {
          message = `Regional overload detected: ${load.toFixed(1)}% load`;
          if (context.region) {
            message += ` in region ${context.region}`;
          }
        }
        break;

      case 'METER_OUTAGE':
        const lastSeenAgo = context.data.last_seen_ago_ms;
        if (lastSeenAgo) {
          const secondsAgo = Math.round(lastSeenAgo / 1000);
          message = `Meter outage detected: No data received for ${secondsAgo} seconds`;
          if (context.meter_id) {
            message += ` from meter ${context.meter_id}`;
          }
        }
        break;

      case 'HIGH_CONSUMPTION':
        const consumption = context.data.consumption;
        if (consumption) {
          message = `High consumption detected: ${consumption.toFixed(1)} kWh`;
          if (context.meter_id) {
            message += ` from meter ${context.meter_id}`;
          }
        }
        break;
    }

    return message;
  }

  private generateAlertMetadata(rule: AlertRule, context: RuleEvaluationContext): Record<string, any> {
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      rule_version: '1.0',
      evaluation_timestamp: context.timestamp.toISOString(),
      context_data: context.data,
      conditions_evaluated: rule.conditions.length,
      ...(context.region && { region: context.region }),
      ...(context.meter_id && { meter_id: context.meter_id })
    };
  }

  async enableRule(ruleId: string): Promise<boolean> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = true;
    logger.info(`Enabled alert rule: ${ruleId}`);
    return true;
  }

  async disableRule(ruleId: string): Promise<boolean> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = false;
    logger.info(`Disabled alert rule: ${ruleId}`);
    return true;
  }

  async clearCooldown(ruleId: string, region?: string, meterId?: string): Promise<void> {
    try {
      const rule = this.getRule(ruleId);
      if (!rule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      const context: RuleEvaluationContext = {
        region,
        meter_id: meterId,
        timestamp: new Date(),
        data: {}
      };

      const cooldownKey = this.getCooldownKey(rule, context);
      await redisService.delete(cooldownKey);

      logger.info(`Cleared cooldown for rule ${ruleId}`, { region, meterId });

    } catch (error) {
      logger.error(`Failed to clear cooldown for rule ${ruleId}:`, error);
      throw error;
    }
  }

  getStatistics(): Record<string, any> {
    const rules = this.getAllRules();
    const enabledCount = rules.filter(r => r.enabled).length;
    const rulesByType = rules.reduce((acc, rule) => {
      acc[rule.type] = (acc[rule.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_rules: rules.length,
      enabled_rules: enabledCount,
      disabled_rules: rules.length - enabledCount,
      rules_by_type: rulesByType,
      rules_by_severity: rules.reduce((acc, rule) => {
        acc[rule.severity] = (acc[rule.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const alertRulesEngine = new AlertRulesEngine();