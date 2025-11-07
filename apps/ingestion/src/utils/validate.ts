/**
 * Validation utilities using Zod
 * 
 * Validates incoming telemetry readings against the schema
 * defined in @segs/shared-types.
 */

import { z } from 'zod';
import type { TelemetryReading } from '@segs/shared-types';

/**
 * Zod schema for TelemetryReading validation
 */
export const TelemetryReadingSchema = z.object({
  readingId: z.string().uuid(),
  meterId: z.string(),
  userId: z.string().optional(),
  timestamp: z.string().datetime(),
  powerKw: z.number().min(0),
  energyKwh: z.number().min(0).optional(),
  voltage: z.number().min(0).max(500).optional(),
  region: z.string().min(1),
  seq: z.number().optional(),
  status: z.enum(['OK', 'ERROR']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for batch telemetry validation
 */
export const TelemetryBatchSchema = z.object({
  readings: z.array(TelemetryReadingSchema).min(1).max(1000),
});

/**
 * Validate a single telemetry reading
 */
export function validateReading(data: unknown): {
  success: true;
  data: TelemetryReading;
} | {
  success: false;
  errors: string[];
} {
  try {
    const validated = TelemetryReadingSchema.parse(data);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate a batch of telemetry readings
 */
export function validateBatch(data: unknown): {
  success: true;
  data: TelemetryReading[];
} | {
  success: false;
  errors: string[];
} {
  try {
    const validated = TelemetryBatchSchema.parse(data);
    return {
      success: true,
      data: validated.readings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate and filter a batch of readings
 * Returns valid readings and invalid reading info
 */
export function validateAndFilterBatch(readings: unknown[]): {
  valid: TelemetryReading[];
  invalid: Array<{ index: number; errors: string[] }>;
} {
  const valid: TelemetryReading[] = [];
  const invalid: Array<{ index: number; errors: string[] }> = [];

  readings.forEach((reading, index) => {
    const result = validateReading(reading);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ index, errors: result.errors });
    }
  });

  return { valid, invalid };
}
