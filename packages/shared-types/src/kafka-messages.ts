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

export interface MeterAggregateMessage {
  meterId: string;
  region: string;
  windowStart: string;
  avgPowerKw: number;
  maxPowerKw: number;
  energyKwhSum: number;
  count: number;
}

export interface AnomalyAlertMessage {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

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
  metadata: Record<string, unknown>;
  processing_timestamp: string;
  source: 'alert-service';
}

export interface AlertStatusUpdateMessage {
  alert_id: string;
  status: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  source: 'alert-service';
}

export interface TariffUpdateMessage {
  tariffId: string;
  region: string;
  pricePerKwh: number;
  effectiveFrom: string;
  reason?: string;
  triggeredBy: string;
  oldPrice?: number;
}

export interface BillingUpdateMessage {
  invoice_id: string;
  user_id: number;
  meter_id: string;
  region: string;
  billing_period: string;
  consumption_kwh: number;
  tariff_rate: number;
  base_cost: number;
  tax_amount: number;
  total_cost: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  generated_at: string;
  source: 'api-gateway';
}

export interface PaymentUpdateMessage {
  transaction_id: string;
  invoice_id: string;
  user_id: number;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  timestamp: string;
  reference_number?: string;
  source: 'api-gateway';
}

export interface DisputeUpdateMessage {
  dispute_id: string;
  invoice_id: string;
  user_id: number;
  status: 'open' | 'under_review' | 'resolved' | 'rejected';
  reason: string;
  description?: string;
  created_at: string;
  updated_at: string;
  resolved_by?: string;
  resolution?: string;
  source: 'api-gateway';
}

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

export function isBillingUpdateMessage(obj: unknown): obj is BillingUpdateMessage {
  const msg = obj as BillingUpdateMessage;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.invoice_id === 'string' &&
    typeof msg.user_id === 'number' &&
    typeof msg.meter_id === 'string' &&
    typeof msg.consumption_kwh === 'number' &&
    msg.source === 'api-gateway'
  );
}


export function isPaymentUpdateMessage(obj: unknown): obj is PaymentUpdateMessage {
  const msg = obj as PaymentUpdateMessage;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.transaction_id === 'string' &&
    typeof msg.invoice_id === 'string' &&
    typeof msg.user_id === 'number' &&
    typeof msg.amount === 'number' &&
    msg.source === 'api-gateway'
  );
}


export function isDisputeUpdateMessage(obj: unknown): obj is DisputeUpdateMessage {
  const msg = obj as DisputeUpdateMessage;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.dispute_id === 'string' &&
    typeof msg.invoice_id === 'string' &&
    typeof msg.user_id === 'number' &&
    typeof msg.status === 'string' &&
    msg.source === 'api-gateway'
  );
}
