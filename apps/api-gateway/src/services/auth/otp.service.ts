/**
 * OTP Service
 * Handles OTP generation, verification, and management
 */

import crypto from 'crypto';
import { env } from '../../config/env.js';
import { pool } from '../../utils/db.js';
import { BadRequestError, UnauthorizedError } from '../../utils/errors.js';

export type OTPPurpose = 'email_verification' | 'password_reset' | 'login_2fa';

/**
 * Generate a random 6-digit OTP
 */
export const generateOTP = (): string => {
  // In development, use master OTP if configured
  if (env.NODE_ENV === 'development' && env.MASTER_OTP) {
    return env.MASTER_OTP;
  }

  // Generate random 6-digit number
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Create OTP record in database
 */
export const createOTP = async (
  email: string,
  purpose: OTPPurpose = 'email_verification'
): Promise<string> => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  const query = `
    INSERT INTO otp_verifications (email, otp, purpose, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id, otp
  `;

  await pool.query(query, [email, otp, purpose, expiresAt]);

  return otp;
};

// * verify OTP controller
export const verifyOTP = async (email: string, otp: string, purpose: OTPPurpose = 'email_verification'): Promise<boolean> => {
  const query = `
    SELECT id, otp, expires_at, verified, attempts
    FROM otp_verifications
    WHERE email = $1 AND purpose = $2 AND verified = false
    ORDER BY created_at DESC LIMIT 1
  `;

  const result = await pool.query(query, [email, purpose]);
  if (result.rows.length === 0)
    throw new BadRequestError('No OTP found for this email');

  const otpRecord = result.rows[0];
  if (new Date() > new Date(otpRecord.expires_at))
    throw new BadRequestError('OTP has expired');

  if (otpRecord.attempts >= env.MAX_LOGIN_ATTEMPTS)
    throw new BadRequestError('Too many attempts. Please request a new OTP');

  await pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
  if (otpRecord.otp !== otp) throw new UnauthorizedError('Invalid OTP');

  await pool.query('UPDATE otp_verifications SET verified = true, verified_at = NOW() WHERE id = $1', [otpRecord.id]);
  return true;
};

/**
 * Check if OTP exists and is valid (without verifying)
 */
export const checkOTPExists = async (
  email: string,
  purpose: OTPPurpose = 'email_verification'
): Promise<boolean> => {
  const query = `
    SELECT id
    FROM otp_verifications
    WHERE email = $1 
      AND purpose = $2 
      AND verified = false 
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [email, purpose]);
  return result.rows.length > 0;
};

/**
 * Delete all OTPs for an email and purpose
 */
export const deleteOTPs = async (
  email: string,
  purpose?: OTPPurpose
): Promise<void> => {
  let query = 'DELETE FROM otp_verifications WHERE email = $1';
  const params: any[] = [email];

  if (purpose) {
    query += ' AND purpose = $2';
    params.push(purpose);
  }

  await pool.query(query, params);
};

/**
 * Clean up expired OTPs (can be called periodically)
 */
export const cleanupExpiredOTPs = async (): Promise<number> => {
  const result = await pool.query(
    'DELETE FROM otp_verifications WHERE expires_at < NOW()'
  );

  return result.rowCount || 0;
};

/**
 * Resend OTP (creates new one and invalidates old ones)
 */
export const resendOTP = async (
  email: string,
  purpose: OTPPurpose = 'email_verification'
): Promise<string> => {
  // Invalidate old OTPs
  await pool.query(
    'UPDATE otp_verifications SET verified = true WHERE email = $1 AND purpose = $2',
    [email, purpose]
  );

  // Create new OTP
  return await createOTP(email, purpose);
};
