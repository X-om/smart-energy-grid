/**
 * Example usage of @segs/shared-types
 * This file demonstrates how to use the shared types in your services.
 */

import {
  TelemetryReading,
  isTelemetryReading,
  Aggregate1m,
  Aggregate15m,
  TariffUpdate,
  Alert,
  AlertType,
  AlertSeverity,
  User,
  UserRole,
  Meter,
  Invoice,
  InvoiceItem,
  HealthResponse,
  KafkaEvent,
  PaginatedResponse,
  ErrorResponse,
  WebSocketMessage,
} from './index.js';

// Example 1: Creating a telemetry reading
const reading: TelemetryReading = {
  readingId: '550e8400-e29b-41d4-a716-446655440000',
  meterId: 'MTR-12345',
  userId: 'USR-001',
  timestamp: new Date().toISOString(),
  powerKw: 5.2,
  energyKwh: 0.5,
  voltage: 230,
  region: 'north',
  seq: 1,
  status: 'OK',
  metadata: {
    temperature: 22.5,
    humidity: 65,
  },
};

// Example 2: Using type guards
function processData(data: unknown): void {
  if (isTelemetryReading(data)) {
    console.log(`Processing reading from meter ${data.meterId}`);
    console.log(`Power: ${data.powerKw} kW, Region: ${data.region}`);
  } else {
    console.log('Invalid telemetry reading');
  }
}

// Example 3: Creating aggregates
const aggregate1m: Aggregate1m = {
  meterId: 'MTR-12345',
  region: 'north',
  windowStart: '2025-11-07T10:00:00Z',
  windowEnd: '2025-11-07T10:01:00Z',
  avgPowerKw: 5.1,
  maxPowerKw: 6.2,
  energyKwhSum: 0.085,
  count: 6,
  granularity: '1m',
};

const aggregate15m: Aggregate15m = {
  meterId: 'MTR-12345',
  region: 'north',
  windowStart: '2025-11-07T10:00:00Z',
  windowEnd: '2025-11-07T10:15:00Z',
  avgPowerKw: 5.3,
  maxPowerKw: 7.1,
  energyKwhSum: 1.325,
  count: 90,
  granularity: '15m',
};

// Example 4: Creating tariff updates
const tariffUpdate: TariffUpdate = {
  tariffId: 'TRF-001',
  region: 'north',
  effectiveFrom: new Date().toISOString(),
  pricePerKwh: 0.15,
  reason: 'Grid load exceeded 80%',
  triggeredBy: 'AUTO',
  createdAt: new Date().toISOString(),
};

// Example 5: Creating alerts
// All available alert types
export const alertTypes: AlertType[] = [
  'REGIONAL_OVERLOAD',
  'METER_OUTAGE',
  'ANOMALY',
  'SYSTEM_FAILURE',
];

// All available severity levels
export const severityLevels: AlertSeverity[] = ['INFO', 'WARN', 'CRITICAL'];

const alert: Alert = {
  alertId: 'ALT-001',
  type: 'REGIONAL_OVERLOAD',
  severity: 'CRITICAL',
  region: 'north',
  message: 'Regional power consumption exceeded 90% of capacity',
  timestamp: new Date().toISOString(),
  acknowledged: false,
  metadata: {
    currentLoad: 450,
    maxCapacity: 500,
    utilizationPercent: 90,
  },
};

// Example 6: Creating users and meters
const user: User = {
  userId: 'USR-001',
  name: 'John Doe',
  email: 'john.doe@example.com',
  region: 'north',
  role: 'USER',
  createdAt: new Date().toISOString(),
  active: true,
  phone: '+1234567890',
};

// All available user roles
export const roles: UserRole[] = ['USER', 'OPERATOR', 'ADMIN'];

const meter: Meter = {
  meterId: 'MTR-12345',
  userId: 'USR-001',
  region: 'north',
  installedAt: '2025-01-15T00:00:00Z',
  status: 'ACTIVE',
  model: 'SmartMeter-3000',
  firmwareVersion: '2.1.5',
  address: '123 Main St, City',
  lastSeenAt: new Date().toISOString(),
};

// Example 7: Creating invoices
const invoiceItem: InvoiceItem = {
  startTime: '2025-11-01T00:00:00Z',
  endTime: '2025-11-01T12:00:00Z',
  energyKwh: 120.5,
  pricePerKwh: 0.12,
  cost: 14.46,
  description: 'Standard Rate - Day',
};

const invoice: Invoice = {
  invoiceId: 'INV-2025-11-001',
  userId: 'USR-001',
  meterId: 'MTR-12345',
  periodStart: '2025-11-01T00:00:00Z',
  periodEnd: '2025-11-30T23:59:59Z',
  totalEnergyKwh: 850.5,
  totalCost: 102.06,
  items: [invoiceItem],
  createdAt: new Date().toISOString(),
  status: 'ISSUED',
  dueDate: '2025-12-15T00:00:00Z',
  currency: 'USD',
};

// Example 8: Creating Kafka events
const kafkaEvent: KafkaEvent<TelemetryReading> = {
  topic: 'raw_readings',
  key: reading.meterId,
  value: reading,
  timestamp: new Date().toISOString(),
  type: 'TelemetryReading',
  correlationId: '123e4567-e89b-12d3-a456-426614174000',
};

// Example 9: Health check response
const healthResponse: HealthResponse = {
  status: 'ok',
  service: 'ingestion-service',
  timestamp: new Date().toISOString(),
  version: '1.0.0',
  uptime: 86400,
  dependencies: {
    kafka: {
      status: 'ok',
      responseTime: 15,
    },
    database: {
      status: 'ok',
      responseTime: 8,
    },
    redis: {
      status: 'ok',
      responseTime: 2,
    },
  },
};

// Example 10: Paginated API response
const paginatedResponse: PaginatedResponse<TelemetryReading> = {
  data: [reading],
  pagination: {
    page: 1,
    limit: 50,
    total: 1234,
    totalPages: 25,
    hasNext: true,
    hasPrev: false,
  },
};

// Example 11: Error response
const errorResponse: ErrorResponse = {
  statusCode: 400,
  message: 'Invalid telemetry reading',
  code: 'INVALID_INPUT',
  timestamp: new Date().toISOString(),
  path: '/api/v1/telemetry',
  errors: [
    {
      field: 'powerKw',
      message: 'Power value must be positive',
      value: -5,
    },
  ],
};

// Example 12: WebSocket message
const wsMessage: WebSocketMessage<Alert> = {
  type: 'alert',
  data: alert,
  timestamp: new Date().toISOString(),
  correlationId: '123e4567-e89b-12d3-a456-426614174000',
};

// Export examples for testing
export {
  reading,
  aggregate1m,
  aggregate15m,
  tariffUpdate,
  alert,
  user,
  meter,
  invoice,
  kafkaEvent,
  healthResponse,
  paginatedResponse,
  errorResponse,
  wsMessage,
  processData,
};

console.log('✅ @segs/shared-types - All example types created successfully');
