import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from './errors.js';

// * Generic request validator middleware factory
export const validateRequest = (schema: ZodSchema) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success)
        throw new ValidationError('Validation failed', result.error.issues);

      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };

// * Validate query parameters
export const validateQuery = (schema: ZodSchema) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) throw new ValidationError('Query validation failed', result.error.issues);

      req.query = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };

// * Validate URL parameters
export const validateParams = (schema: ZodSchema) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = schema.safeParse(req.params);
      if (!result.success) throw new ValidationError('Parameter validation failed', result.error.issues);

      req.params = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };


// * UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// * Email validation
export const emailSchema = z.string().email('Invalid email format').toLowerCase();

// * Password validation (min 8 chars, at least one letter and one number)
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// * Phone validation (basic)
export const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

// * Region validation
export const regionSchema = z.enum([
  'Mumbai-North', 'Mumbai-South',
  'Delhi-North', 'Delhi-South',
  'Bangalore-East', 'Bangalore-West',
  'Pune-East', 'Pune-West',
  'Hyderabad-Central',
  'Chennai-North'
], {
  errorMap: () => ({ message: 'Invalid region. Must be a valid city-region combination' }),
});

// * Role validation
export const roleSchema = z.enum(['user', 'operator', 'admin'], {
  errorMap: () => ({ message: 'Invalid role. Must be user, operator, or admin' }),
});

// * Meter ID validation (alphanumeric with hyphens)
export const meterIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/, 'Meter ID must contain only alphanumeric characters and hyphens')
  .min(5, 'Meter ID must be at least 5 characters')
  .max(50, 'Meter ID must not exceed 50 characters');

// * Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// * Date range validation
export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// * OTP validation
export const otpSchema = z.string()
  .length(6, 'OTP must be exactly 6 characters')
  .regex(/^[0-9]+$/, 'OTP must contain only numbers');

// * Helper: Sanitize string input
export const sanitizeString = (input: string): string => input.trim().replace(/\s+/g, ' ');

// * Helper: Check if date is in the past
export const isPastDate = (date: Date): boolean => date < new Date();

// * Helper: Check if date is in the future
export const isFutureDate = (date: Date): boolean => date > new Date();

// * Helper: Validate time range (from < to)
export const isValidTimeRange = (from: Date, to: Date): boolean => {
  return from < to;
};
