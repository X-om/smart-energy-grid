import { z } from 'zod';
import { emailSchema, passwordSchema, otpSchema } from '../../utils/validators';

// * Register schema
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
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

// * Verify OTP schema
export const verifyOTPSchema = z.object({
  email: emailSchema,
  otp: otpSchema
});

// * Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

// * Set password schema (after email verification)
export const setPasswordSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword']
});

// * Change password schema (authenticated user)
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// * Forgot password schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// * Reset password schema
export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// * Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// * Resend OTP schema
export const resendOTPSchema = z.object({
  email: emailSchema,
  purpose: z.enum(['email_verification', 'password_reset', 'login_2fa']).optional(),
});
