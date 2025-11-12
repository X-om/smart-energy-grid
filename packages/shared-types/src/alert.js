"use strict";
/**
 * Alert and notification models for system events.
 * Used by alert service and notification service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAlert = isAlert;
exports.isAlertType = isAlertType;
exports.isAlertSeverity = isAlertSeverity;
/**
 * Type guard to check if an object is a valid Alert
 */
function isAlert(obj) {
    const alert = obj;
    return (typeof alert === 'object' &&
        alert !== null &&
        typeof alert.alertId === 'string' &&
        typeof alert.type === 'string' &&
        typeof alert.severity === 'string' &&
        typeof alert.message === 'string' &&
        typeof alert.timestamp === 'string');
}
/**
 * Type guard to check if an alert type is valid
 */
function isAlertType(value) {
    return ['REGIONAL_OVERLOAD', 'METER_OUTAGE', 'ANOMALY', 'SYSTEM_FAILURE'].includes(value);
}
/**
 * Type guard to check if a severity level is valid
 */
function isAlertSeverity(value) {
    return ['INFO', 'WARN', 'CRITICAL'].includes(value);
}
//# sourceMappingURL=alert.js.map