# @segs/shared-types

> Canonical TypeScript type definitions for the Smart Energy Grid Management System (SEGS)

## Overview

This package provides type safety and shared contracts across all microservices in the SEGS distributed system. It serves as the single source of truth for data models, ensuring consistency and type safety throughout the entire architecture.

## Features

- ✅ **Strict TypeScript types** with full IntelliSense support
- ✅ **Type guards** for runtime validation
- ✅ **Comprehensive JSDoc comments** for all interfaces
- ✅ **Zero dependencies** (only devDependencies)
- ✅ **ESM compatible** with proper declaration maps
- ✅ **Modular exports** for tree-shaking optimization

## Installation

```bash
# In the monorepo, this package is automatically linked
pnpm add @segs/shared-types
```

## Usage

```typescript
import {
  TelemetryReading,
  Aggregate1m,
  TariffUpdate,
  Alert,
  User,
  Invoice,
  HealthResponse,
  KafkaEvent
} from '@segs/shared-types';

// Use types in your service
const reading: TelemetryReading = {
  readingId: '123e4567-e89b-12d3-a456-426614174000',
  meterId: 'MTR-001',
  timestamp: new Date().toISOString(),
  powerKw: 5.2,
  region: 'north',
  status: 'OK'
};

// Type guards for runtime validation
if (isTelemetryReading(data)) {
  console.log('Valid telemetry reading:', data.meterId);
}
```

## Type Modules

### 📊 `telemetry.ts`
Core telemetry data models for smart meter readings.

**Exports:**
- `TelemetryReading` - Single meter reading with power consumption data
- `isTelemetryReading()` - Type guard

### 📈 `aggregates.ts`
Time-series aggregation models for analytics.

**Exports:**
- `AggregateBase` - Base structure for aggregations
- `Aggregate1m` - 1-minute window aggregates
- `Aggregate15m` - 15-minute window aggregates
- `Aggregate` - Union type for all aggregates
- `isAggregate1m()`, `isAggregate15m()` - Type guards

### 💰 `tariff.ts`
Dynamic electricity pricing models.

**Exports:**
- `TariffUpdate` - Tariff change event
- `TariffSchedule` - Historical tariff schedule
- `isTariffUpdate()` - Type guard

### 🚨 `alert.ts`
Alert and notification event models.

**Exports:**
- `AlertType` - Alert categories (overload, outage, anomaly, failure)
- `AlertSeverity` - Severity levels (INFO, WARN, CRITICAL)
- `Alert` - Alert event structure
- `AlertRule` - Alert rule configuration
- `isAlert()`, `isAlertType()`, `isAlertSeverity()` - Type guards

### 👤 `user.ts`
User accounts and meter metadata.

**Exports:**
- `UserRole` - Role enum (USER, OPERATOR, ADMIN)
- `User` - User account model
- `MeterStatus` - Meter operational status
- `Meter` - Smart meter device model
- `UserCredentials` - Login credentials
- `TokenPayload` - JWT token payload
- `isUser()`, `isUserRole()`, `isMeter()` - Type guards

### 💵 `billing.ts`
Invoice and payment models.

**Exports:**
- `InvoiceItem` - Single billing period line item
- `InvoiceStatus` - Invoice workflow status
- `Invoice` - Complete invoice document
- `BillingSummary` - Period summary statistics
- `Payment` - Payment transaction record
- `isInvoice()`, `isInvoiceItem()` - Type guards

### 🔧 `common.ts`
Shared utility types and common interfaces.

**Exports:**
- `HealthStatus`, `HealthResponse`, `DependencyHealth` - Service health checks
- `KafkaEvent<T>` - Generic Kafka message wrapper
- `RedisKey<T>` - Type-safe Redis operations
- `PaginationParams`, `PaginatedResponse<T>` - API pagination
- `ErrorResponse`, `ValidationError` - Error handling
- `TimeRange` - Time-based queries
- `ServiceConfig` - Service configuration
- `WebSocketMessage<T>` - Real-time messaging
- Type guards: `isHealthResponse()`, `isKafkaEvent()`, `isErrorResponse()`

## Type Guards

All major types include runtime type guards for validation:

```typescript
import { isTelemetryReading, isAlert, isInvoice } from '@segs/shared-types';

// Validate unknown data
const data: unknown = await fetchData();

if (isTelemetryReading(data)) {
  // TypeScript now knows data is TelemetryReading
  console.log(data.meterId, data.powerKw);
}
```

## Best Practices

### 1. Always use strict types
```typescript
// ✅ Good
const reading: TelemetryReading = { ... };

// ❌ Bad
const reading: any = { ... };
```

### 2. Leverage type guards
```typescript
// ✅ Good - safe runtime validation
if (isAlert(message)) {
  handleAlert(message);
}

// ❌ Bad - unsafe type assertion
handleAlert(message as Alert);
```

### 3. Use generic wrappers
```typescript
// ✅ Good - type-safe Kafka events
const event: KafkaEvent<TelemetryReading> = {
  topic: 'raw_readings',
  value: reading,
  timestamp: new Date().toISOString()
};
```

### 4. Extend types when needed
```typescript
// ✅ Good - extend base types
interface EnrichedReading extends TelemetryReading {
  processedAt: string;
  anomalyScore: number;
}
```

## Building

```bash
# Build type declarations
pnpm build

# Clean build artifacts
pnpm clean

# Rebuild from scratch
pnpm clean && pnpm build
```

## Development

When adding new types:

1. Create a new module file in `src/` (e.g., `maintenance.ts`)
2. Add comprehensive JSDoc comments
3. Include type guards for runtime validation
4. Export from `src/index.ts`
5. Run `pnpm build` to generate declarations
6. Update this README with new exports

## Integration with Services

All SEGS microservices should import types from this package:

```json
{
  "dependencies": {
    "@segs/shared-types": "workspace:*"
  }
}
```

```typescript
// In any service
import { TelemetryReading, Alert } from '@segs/shared-types';
```

## License

Part of the Smart Energy Grid Management System (SEGS) monorepo.

---

**Version:** 1.0.0  
**Maintained by:** SEGS Development Team
