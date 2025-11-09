import { Pool } from 'pg';
import { User } from '../../types/index.js';

export async function getAllUsers(
  pool: Pool,
  filters?: {
    role?: string;
    region?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ users: User[]; total: number }> {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.role) {
    conditions.push(`role = $${paramIndex++}`);
    values.push(filters.role);
  }
  if (filters?.region) {
    conditions.push(`region = $${paramIndex++}`);
    values.push(filters.region);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  // Data
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const dataQuery = `
    SELECT * FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  values.push(limit, offset);

  const result = await pool.query<User>(dataQuery, values);
  return { users: result.rows, total };
}

export async function getUsersByRegion(pool: Pool, region: string): Promise<User[]> {
  const query = 'SELECT * FROM users WHERE region = $1 ORDER BY created_at DESC';
  const result = await pool.query<User>(query, [region]);
  return result.rows;
}
