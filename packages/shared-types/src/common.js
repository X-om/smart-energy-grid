"use strict";
/**
 * Common utility types and interfaces used across all services.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHealthResponse = isHealthResponse;
exports.isKafkaEvent = isKafkaEvent;
exports.isErrorResponse = isErrorResponse;
/**
 * Type guard to check if an object is a valid HealthResponse
 */
function isHealthResponse(obj) {
    const health = obj;
    return (typeof health === 'object' &&
        health !== null &&
        typeof health.status === 'string' &&
        typeof health.service === 'string' &&
        typeof health.timestamp === 'string');
}
/**
 * Type guard to check if an object is a valid KafkaEvent
 */
function isKafkaEvent(obj) {
    const event = obj;
    return (typeof event === 'object' &&
        event !== null &&
        typeof event.topic === 'string' &&
        event.value !== undefined &&
        typeof event.timestamp === 'string');
}
/**
 * Type guard to check if an object is a valid ErrorResponse
 */
function isErrorResponse(obj) {
    const error = obj;
    return (typeof error === 'object' &&
        error !== null &&
        typeof error.statusCode === 'number' &&
        typeof error.message === 'string' &&
        typeof error.code === 'string');
}
//# sourceMappingURL=common.js.map