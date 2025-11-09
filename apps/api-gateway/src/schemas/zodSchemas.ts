import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyOTPSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.string().length(6).regex(/^\d{6}$/),
});
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;

// Assign Meter Schema
export const assignMeterSchema = z.object({
  userId: z.string().uuid(),
  meterId: z.string().min(1),
  region: z.string().min(1),
});
export type AssignMeterInput = z.infer<typeof assignMeterSchema>;

// Change Role Schema
export const changeRoleSchema = z.object({
  role: z.enum(['user', 'operator', 'admin']),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

// Query Params Schema
export const getUsersQuerySchema = z.object({
  role: z.enum(['user', 'operator', 'admin']).optional(),
  region: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});
export type GetUsersQueryInput = z.infer<typeof getUsersQuerySchema>;

// Params Schema
export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});
export type UserIdParamInput = z.infer<typeof userIdParamSchema>;

export const regionParamSchema = z.object({
  region: z.string().min(1),
});
export type RegionParamInput = z.infer<typeof regionParamSchema>;

