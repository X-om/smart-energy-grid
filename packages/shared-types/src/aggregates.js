"use strict";
/**
 * Aggregate data models for time-series analytics.
 * Used by stream processor and analytics services.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAggregate1m = isAggregate1m;
exports.isAggregate15m = isAggregate15m;
exports.isRegionalAggregate = isRegionalAggregate;
/**
 * Type guard to check if an object is a valid Aggregate1m
 */
function isAggregate1m(obj) {
    const agg = obj;
    return (typeof agg === 'object' &&
        agg !== null &&
        agg.granularity === '1m' &&
        typeof agg.meterId === 'string' &&
        typeof agg.avgPowerKw === 'number');
}
/**
 * Type guard to check if an object is a valid Aggregate15m
 */
function isAggregate15m(obj) {
    const agg = obj;
    return (typeof agg === 'object' &&
        agg !== null &&
        agg.granularity === '15m' &&
        typeof agg.meterId === 'string' &&
        typeof agg.avgPowerKw === 'number');
}
/**
 * Type guard to check if an object is a valid RegionalAggregate
 */
function isRegionalAggregate(obj) {
    const agg = obj;
    return (typeof agg === 'object' &&
        agg !== null &&
        typeof agg.region === 'string' &&
        typeof agg.timestamp === 'string' &&
        typeof agg.meter_count === 'number' &&
        typeof agg.total_consumption === 'number' &&
        typeof agg.load_percentage === 'number');
}
//# sourceMappingURL=aggregates.js.map