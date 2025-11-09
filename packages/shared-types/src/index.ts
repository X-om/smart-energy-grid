/**
 * @segs/shared-types
 * 
 * Canonical type definitions for the Smart Energy Grid Management System (SEGS).
 * This package provides type safety and shared contracts across all microservices.
 * 
 * @module @segs/shared-types
 * @version 1.0.0
 */

// Telemetry data models
export * from './telemetry.js';

// Aggregate analytics models
export * from './aggregates.js';

// Tariff pricing models
export * from './tariff.js';

// Alert and notification models
export * from './alert.js';

// User and meter metadata models
export * from './user.js';

// Billing and invoice models
export * from './billing.js';

// Common utility types and interfaces
export * from './common.js';

// Kafka message types
export * from './kafka-messages.js';
