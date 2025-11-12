"use strict";
/**
 * Kafka message types for inter-service communication.
 * These types define the contracts for messages passed between services via Kafka topics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRegionalAggregateMessage = isRegionalAggregateMessage;
exports.isProcessedAlertMessage = isProcessedAlertMessage;
exports.isTariffUpdateMessage = isTariffUpdateMessage;
/**
 * Type guard to check if an object is a valid RegionalAggregateMessage
 */
function isRegionalAggregateMessage(obj) {
    const msg = obj;
    return (typeof msg === 'object' &&
        msg !== null &&
        typeof msg.region === 'string' &&
        typeof msg.timestamp === 'string' &&
        typeof msg.meter_count === 'number' &&
        typeof msg.total_consumption === 'number' &&
        typeof msg.load_percentage === 'number');
}
/**
 * Type guard to check if an object is a valid ProcessedAlertMessage
 */
function isProcessedAlertMessage(obj) {
    const msg = obj;
    return (typeof msg === 'object' &&
        msg !== null &&
        typeof msg.id === 'string' &&
        typeof msg.type === 'string' &&
        typeof msg.severity === 'string' &&
        typeof msg.message === 'string' &&
        typeof msg.status === 'string' &&
        msg.source === 'alert-service');
}
/**
 * Type guard to check if an object is a valid TariffUpdateMessage
 */
function isTariffUpdateMessage(obj) {
    const msg = obj;
    return (typeof msg === 'object' &&
        msg !== null &&
        typeof msg.tariffId === 'string' &&
        typeof msg.region === 'string' &&
        typeof msg.pricePerKwh === 'number' &&
        typeof msg.effectiveFrom === 'string');
}
//# sourceMappingURL=kafka-messages.js.map