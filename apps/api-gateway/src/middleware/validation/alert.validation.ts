import { z } from 'zod';

// * Enum validations
const alertTypeEnum = z.enum([
  'power_outage', 'high_consumption', 'low_voltage', 'meter_malfunction',
  'billing_issue', 'theft_detection', 'grid_overload', 'maintenance_required'
]);

const alertSeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

const alertStatusEnum = z.enum(['active', 'acknowledged', 'resolved', 'closed']);

const regionEnum = z.enum([
  'Mumbai-North', 'Mumbai-South', 'Delhi-North', 'Delhi-South',
  'Bangalore-East', 'Bangalore-West', 'Pune-East', 'Pune-West',
  'Hyderabad-Central', 'Chennai-North'
]);

// * Path parameter schemas
export const alertIdParamSchema = z.object({
  alertId: z.string().uuid('Invalid alert ID format'),
});

// * Query parameter schemas for user alerts
export const userAlertQuerySchema = z.object({
  status: alertStatusEnum.optional(),
  severity: alertSeverityEnum.optional(),
  type: alertTypeEnum.optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});

// * Query parameter schemas for operator alerts
export const operatorAlertQuerySchema = z.object({
  status: alertStatusEnum.optional(),
  severity: alertSeverityEnum.optional(),
  type: alertTypeEnum.optional(),
  region: regionEnum.optional(),
  meter_id: z.string().optional(),
  acknowledged: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});

// * Request body schemas
export const acknowledgeAlertBodySchema = z.object({
  acknowledged_by: z.string().min(1, 'Acknowledger name is required').max(100),
});

export const resolveAlertBodySchema = z.object({
  resolution_notes: z.string().min(10, 'Resolution notes must be at least 10 characters').max(500).optional(),
});

export const bulkResolveBodySchema = z.object({
  alert_ids: z.array(z.string().uuid('Invalid alert ID format')).min(1, 'At least one alert ID is required').max(100, 'Cannot resolve more than 100 alerts at once'),
  resolution_notes: z.string().min(10, 'Resolution notes must be at least 10 characters').max(500).optional(),
});

// * Stats query schema
export const alertStatsQuerySchema = z.object({
  region: regionEnum.optional(),
  type: alertTypeEnum.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// * Alert history query schema
export const alertHistoryQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});
