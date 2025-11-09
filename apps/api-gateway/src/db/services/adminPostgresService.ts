import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export async function changeUserRole(
  pool: Pool,
  userId: string,
  newRole: 'user' | 'operator' | 'admin'
): Promise<void> {
  const query = 'UPDATE users SET role = $1 WHERE user_id = $2';
  await pool.query(query, [newRole, userId]);
  logger.info(`User role changed: ${userId} -> ${newRole}`);
}

export async function deleteUser(pool: Pool, userId: string): Promise<void> {
  const query = 'DELETE FROM users WHERE user_id = $1';
  await pool.query(query, [userId]);
  logger.info(`User deleted: ${userId}`);
}

export async function assignMeterToUser(
  pool: Pool,
  userId: string,
  meterId: string,
  region: string
): Promise<void> {
  const query = 'UPDATE users SET meter_id = $1, region = $2 WHERE user_id = $3';

  try {
    await pool.query(query, [meterId, region, userId]);
    logger.info(`Meter ${meterId} assigned to user ${userId}`);
  } catch (error: any) {
    if (error.code === '23505') {
      throw new Error('Meter already assigned to another user');
    }
    throw error;
  }
}
