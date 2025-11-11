import { z } from 'zod';

// * Region validation
const regionEnum = z.enum([
  'Mumbai-North', 'Mumbai-South', 'Delhi-North', 'Delhi-South',
  'Bangalore-East', 'Bangalore-West', 'Pune-East', 'Pune-West',
  'Hyderabad-Central', 'Chennai-North'
]);

// * Path parameter schemas
export const regionParamSchema = z.object({
  region: regionEnum,
});

export const tariffIdParamSchema = z.object({
  tariffId: z.string().uuid('Invalid tariff ID format'),
});

// * Query parameter schemas
export const tariffHistoryQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).optional(),
});

// * Cost estimation schema
export const estimateQuerySchema = z.object({
  consumption_kwh: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).pipe(z.number().positive('Consumption must be positive')),
  region: regionEnum.optional(),
});

// * Tariff override schema (admin only)
export const overrideBodySchema = z.object({
  region: regionEnum,
  newPrice: z.number().positive('Price must be positive').max(100, 'Price cannot exceed ₹100/kWh'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  operatorId: z.string().optional()
});

// * Analytics query schema
export const analyticsQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  region: regionEnum.optional(),
});
