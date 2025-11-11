import { z } from 'zod';

// * Query parameter schemas
export const resolutionSchema = z.enum(['1m', '15m', '1h', '1d']);

export const timeRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  resolution: resolutionSchema.optional(),
});

export const dailyQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
});

export const monthlyQuerySchema = z.object({
  start_month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)').optional(),
  end_month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)').optional(),
});

export const comparePeriodSchema = z.object({
  period1_start: z.string().datetime(),
  period1_end: z.string().datetime(),
  period2_start: z.string().datetime(),
  period2_end: z.string().datetime(),
});

export const topConsumersSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
});

// * Path parameter schemas
export const meterIdParamSchema = z.object({
  meterId: z.string().min(1, 'Meter ID is required'),
});

export const regionParamSchema = z.object({
  region: z.enum([
    'Mumbai-North', 'Mumbai-South',
    'Delhi-North', 'Delhi-South',
    'Bangalore-East', 'Bangalore-West',
    'Pune-East', 'Pune-West',
    'Hyderabad-Central',
    'Chennai-North'
  ]),
});
