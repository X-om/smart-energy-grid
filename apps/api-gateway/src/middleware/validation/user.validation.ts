import { z } from 'zod';

// * Update profile schema
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number').optional(),
  region: z.enum([
    'Mumbai-North', 'Mumbai-South',
    'Delhi-North', 'Delhi-South',
    'Bangalore-East', 'Bangalore-West',
    'Pune-East', 'Pune-West',
    'Hyderabad-Central',
    'Chennai-North'
  ]).optional(),
});

// * Update preferences schema
export const updatePreferencesSchema = z.object({
  email_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
  websocket_notifications: z.boolean().optional(),
  alert_high_consumption: z.boolean().optional(),
  alert_zero_consumption: z.boolean().optional(),
  alert_tariff_changes: z.boolean().optional(),
  alert_billing_reminders: z.boolean().optional(),
  high_consumption_threshold_kwh: z.number().min(0).max(10000).optional(),
  default_chart_resolution: z.enum(['1m', '15m', '1h', '1d']).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
});
