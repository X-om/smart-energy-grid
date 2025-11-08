import { z } from 'zod';

export const readingSchema = z.object({
  meterId: z.string().min(1, 'Meter ID is required'),
  region: z.string().min(1, 'Region is required'),
  timestamp: z.string().datetime('Invalid timestamp format'),
  powerKw: z.number().min(0, 'Power must be positive'),
  voltage: z.number().min(0, 'Voltage must be positive').optional(),
  current: z.number().min(0, 'Current must be positive').optional(),
  frequency: z.number().min(0, 'Frequency must be positive').optional(),
  powerFactor: z.number().min(0).max(1, 'Power factor must be between 0 and 1').optional(),
  temperature: z.number().optional(),
});

export const batchReadingsSchema = z.array(readingSchema).min(1, 'Batch must contain at least one reading').max(1000, 'Batch size cannot exceed 1000 readings');

export type Reading = z.infer<typeof readingSchema>;
export type BatchReadings = z.infer<typeof batchReadingsSchema>;
