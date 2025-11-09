/**
 * Kafka message types for inter-service communication.
 * These types define the contracts for messages passed between services via Kafka topics.
 */

/**
 * Regional aggregate message published by stream-processor to aggregates_1m_regional topic.
 * Consumed by alert and tariff services for regional analysis.
 */
export interface RegionalAggregateMessage {
  region: string;
  timestamp: string;
  meter_count: number;
  total_consumption: number;
  avg_consumption: number;
  max_consumption: number;
  min_consumption: number;
  load_percentage: number;
  active_meters: string[];
}

/**
 * Per-meter aggregate message published by stream-processor to aggregates_1m topic.
 * Contains 1-minute aggregated metrics for individual meters.
 */
export interface MeterAggregateMessage {
  meterId: string;
  region: string;
  windowStart: string;
  avgPowerKw: number;
  maxPowerKw: number;
  energyKwhSum: number;
  count: number;
}

/**
 * Anomaly alert message published by stream-processor to alerts topic.
 * Consumed by alert service for processing and enrichment.
 */
export interface AnomalyAlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Processed alert message published by alert service to alerts_processed topic.
 * Consumed by notification service for user notifications.
 */
export interface ProcessedAlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata: Record<string, any>;
  processing_timestamp: string;
  source: 'alert-service';
}

/**
 * Alert status update message published by alert service to alert_status_updates topic.
 * Consumed by notification service to broadcast status changes.
 */
export interface AlertStatusUpdateMessage {
  alert_id: string;
  status: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  source: 'alert-service';
}

/**
 * Tariff update message published by tariff service to tariff_updates topic.
 * Consumed by notification service for price change notifications.
 */
export interface TariffUpdateMessage {
  tariffId: string;
  region: string;
  pricePerKwh: number;
  effectiveFrom: string;
  reason?: string;
  triggeredBy: string;
  oldPrice?: number;
}

/**
 * Type guard to check if an object is a valid RegionalAggregateMessage
 */
export function isRegionalAggregateMessage(obj: unknown): obj is RegionalAggregateMessage {
  const msg = obj as RegionalAggregateMessage;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.region === 'string' &&
    typeof msg.timestamp === 'string' &&
    typeof msg.meter_count === 'number' &&
    typeof msg.total_consumption === 'number' &&
    typeof msg.load_percentage === 'number'
  );
}

/**
 * Type guard to check if an object is a valid ProcessedAlertMessage
 */
export function isProcessedAlertMessage(obj: unknown): obj is ProcessedAlertMessage {
  const msg = obj as ProcessedAlertMessage;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.id === 'string' &&
    typeof msg.type === 'string' &&
    typeof msg.severity === 'string' &&
    typeof msg.message === 'string' &&
    typeof msg.status === 'string' &&
    msg.source === 'alert-service'
  );
}

/**
 * Type guard to check if an object is a valid TariffUpdateMessage
 */
export function isTariffUpdateMessage(obj: unknown): obj is TariffUpdateMessage {
  const msg = obj as TariffUpdateMessage;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.tariffId === 'string' &&
    typeof msg.region === 'string' &&
    typeof msg.pricePerKwh === 'number' &&
    typeof msg.effectiveFrom === 'string'
  );
}
