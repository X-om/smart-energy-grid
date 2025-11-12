"use strict";
/**
 * Tariff pricing models for dynamic electricity pricing.
 * Used by tariff service and billing calculations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTariffUpdate = isTariffUpdate;
/**
 * Type guard to check if an object is a valid TariffUpdate
 */
function isTariffUpdate(obj) {
    const tariff = obj;
    return (typeof tariff === 'object' &&
        tariff !== null &&
        typeof tariff.tariffId === 'string' &&
        typeof tariff.region === 'string' &&
        typeof tariff.effectiveFrom === 'string' &&
        typeof tariff.pricePerKwh === 'number' &&
        (tariff.triggeredBy === 'AUTO' || tariff.triggeredBy === 'MANUAL'));
}
//# sourceMappingURL=tariff.js.map