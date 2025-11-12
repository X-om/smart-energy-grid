export type AlertType = | 'REGIONAL_OVERLOAD' | 'METER_OUTAGE' | 'ANOMALY' | 'SYSTEM_FAILURE';
export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface Alert {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  region?: string;
  meterId?: string;
  message: string;
  timestamp: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  ruleId: string;
  name: string;
  alertType: AlertType;
  severity: AlertSeverity;
  condition: string;
  windowSeconds: number;
  enabled: boolean;
  region?: string;
}

export function isAlert(obj: unknown): obj is Alert {
  const alert = obj as Alert;
  return (
    typeof alert === 'object' &&
    alert !== null &&
    typeof alert.alertId === 'string' &&
    typeof alert.type === 'string' &&
    typeof alert.severity === 'string' &&
    typeof alert.message === 'string' &&
    typeof alert.timestamp === 'string'
  );
}

export function isAlertType(value: string): value is AlertType {
  return ['REGIONAL_OVERLOAD', 'METER_OUTAGE', 'ANOMALY', 'SYSTEM_FAILURE'].includes(value);
}

export function isAlertSeverity(value: string): value is AlertSeverity {
  return ['INFO', 'WARN', 'CRITICAL'].includes(value);
}
