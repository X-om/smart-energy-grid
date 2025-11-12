"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTelemetryReading = void 0;
// * Type guard to check if an object is a valid TelemetryReading
const isTelemetryReading = (obj) => {
    const reading = obj;
    return (typeof reading === 'object' && reading !== null && typeof reading.readingId === 'string' && typeof reading.meterId === 'string' &&
        typeof reading.timestamp === 'string' && typeof reading.powerKw === 'number' && typeof reading.region === 'string');
};
exports.isTelemetryReading = isTelemetryReading;
//# sourceMappingURL=telemetry.js.map