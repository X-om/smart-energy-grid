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
export * from './telemetry';

// Aggregate analytics models
export * from './aggregates';

// Tariff pricing models
export * from './tariff';

// Alert and notification models
export * from './alert';

// User and meter metadata models
export * from './user';

// Billing and invoice models
export * from './billing';

// Common utility types and interfaces
export * from './common';

// Shared constants
export * from './constants';

// Kafka message types
export * from './kafka-messages';
