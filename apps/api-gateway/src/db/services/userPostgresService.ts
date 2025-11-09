import { Pool } from 'pg';
import { User } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export async function createUser(pool: Pool, name: string, email: string): Promise<User> {
  const userId = randomUUID();
  const query = `
    INSERT INTO users (user_id, name, email, role, email_verified, password_hash)
    VALUES ($1, $2, $3, 'USER', false, '')
    RETURNING *
  `;

  try {
    const result = await pool.query<User>(query, [userId, name, email]);
    logger.info(`User created: ${email}`);
    return result.rows[0];
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('User with this email already exists');
    }
    logger.error('Error creating user', error);
    throw error;
  }
}

export async function findUserByEmail(pool: Pool, email: string): Promise<User | null> {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query<User>(query, [email]);
  return result.rows[0] || null;
}

export async function findUserById(pool: Pool, userId: string): Promise<User | null> {
  const query = 'SELECT * FROM users WHERE user_id = $1';
  const result = await pool.query<User>(query, [userId]);
  return result.rows[0] || null;
}

export async function verifyUserEmail(pool: Pool, email: string): Promise<void> {
  const query = 'UPDATE users SET email_verified = true WHERE email = $1';
  await pool.query(query, [email]);
  logger.info(`Email verified: ${email}`);
}

export async function createOTP(pool: Pool, email: string, otp: string, expiryMinutes: number): Promise<void> {
  const query = `
    INSERT INTO otp_verifications (email, otp, expires_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '${expiryMinutes} minutes')
  `;
  await pool.query(query, [email, otp]);
  logger.info(`OTP created for: ${email}`);
}

export async function verifyOTP(pool: Pool, email: string, otp: string): Promise<boolean> {
  const query = `
    SELECT * FROM otp_verifications
    WHERE email = $1 AND otp = $2 AND verified = false AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [email, otp]);

  if (result.rows.length === 0) {
    return false;
  }

  // Mark as verified
  const updateQuery = 'UPDATE otp_verifications SET verified = true WHERE email = $1 AND otp = $2';
  await pool.query(updateQuery, [email, otp]);

  logger.info(`OTP verified for: ${email}`);
  return true;
}
