"use strict";
/**
 * @segs/shared-types
 *
 * Canonical type definitions for the Smart Energy Grid Management System (SEGS).
 * This package provides type safety and shared contracts across all microservices.
 *
 * @module @segs/shared-types
 * @version 1.0.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Telemetry data models
__exportStar(require("./telemetry"), exports);
// Aggregate analytics models
__exportStar(require("./aggregates"), exports);
// Tariff pricing models
__exportStar(require("./tariff"), exports);
// Alert and notification models
__exportStar(require("./alert"), exports);
// User and meter metadata models
__exportStar(require("./user"), exports);
// Billing and invoice models
__exportStar(require("./billing"), exports);
// Common utility types and interfaces
__exportStar(require("./common"), exports);
// Kafka message types
__exportStar(require("./kafka-messages"), exports);
//# sourceMappingURL=index.js.map