import { pool } from '../../utils/db.js';
import { NotFoundError, ConflictError, DatabaseError } from '../../utils/errors.js';
import { randomUUID } from 'crypto';

export interface User {
  user_id: string;
  email: string;
  password_hash: string | null;
  name: string;
  phone: string | null;
  role: 'user' | 'operator' | 'admin';
  meter_id: string | null;
  region: string | null;
  email_verified: boolean;
  is_active: boolean;
  suspended_at: Date | null;
  suspended_reason: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
  phone?: string;
  role?: 'user' | 'operator' | 'admin';
  region?: string;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  region?: string;
}

// * Create a new user
export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    const { email, name, phone, role = 'user', region } = input;
    const userId = randomUUID();
    const query = `
      INSERT INTO users (user_id, email, name, phone, role, region)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [userId, email, name, phone, role, region]);
    return result.rows[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === '23505') throw new ConflictError('User with this email already exists');
    throw new DatabaseError('Failed to create user', error);
  }
};

// * Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  const query = 'SELECT * FROM users WHERE user_id = $1';
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

// * Get user by email
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
};

// * Get user by meter ID
export const getUserByMeterId = async (meterId: string): Promise<User | null> => {
  const query = 'SELECT * FROM users WHERE meter_id = $1';
  const result = await pool.query(query, [meterId]);
  return result.rows[0] || null;
};

// * Update user
export const updateUser = async (userId: string, input: UpdateUserInput): Promise<User> => {
  const fields: string[] = [];
  const values: unknown[] = [];

  let paramCount = 1;
  if (input.name !== undefined) {
    fields.push(`name = $${paramCount++}`); values.push(input.name);
  }

  if (input.phone !== undefined) {
    fields.push(`phone = $${paramCount++}`); values.push(input.phone);
  }

  if (input.region !== undefined) {
    fields.push(`region = $${paramCount++}`); values.push(input.region);
  }

  if (fields.length === 0) {
    const user = await getUserById(userId);
    if (!user) throw new NotFoundError('User not found');

    return user;
  }

  values.push(userId);
  const query = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE user_id = $${paramCount} RETURNING *`;
  const result = await pool.query(query, values);

  if (result.rows.length === 0) throw new NotFoundError('User not found');
  return result.rows[0];
};

// * Set user password
export const setUserPassword = async (userId: string, passwordHash: string): Promise<void> => {
  const query = `
    UPDATE users
    SET password_hash = $1, updated_at = NOW()
    WHERE user_id = $2
  `;
  const result = await pool.query(query, [passwordHash, userId]);
  if (result.rowCount === 0) throw new NotFoundError('User not found');
};

// * Verify user email
export const verifyUserEmail = async (email: string): Promise<void> => {
  const query = `
    UPDATE users
    SET email_verified = true, updated_at = NOW()
    WHERE email = $1
  `;

  const result = await pool.query(query, [email]);
  if (result.rowCount === 0) throw new NotFoundError('User not found');
};

// * Update last login time
export const updateLastLogin = async (userId: string): Promise<void> => {
  const query = `
    UPDATE users
    SET last_login_at = NOW()
    WHERE user_id = $1
  `;
  await pool.query(query, [userId]);
};

// * Suspend user
export const suspendUser = async (userId: string, reason: string): Promise<User> => {
  const query = `
    UPDATE users
    SET is_active = false, suspended_at = NOW(), suspended_reason = $1, updated_at = NOW()
    WHERE user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [reason, userId]);

  if (result.rows.length === 0) throw new NotFoundError('User not found');
  return result.rows[0];
};

// * Activate user
export const activateUser = async (userId: string): Promise<User> => {
  const query = `
    UPDATE users
    SET is_active = true, suspended_at = NULL, suspended_reason = NULL, updated_at = NOW()
    WHERE user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [userId]);
  if (result.rows.length === 0) throw new NotFoundError('User not found');

  return result.rows[0];
};

// * Change user role
export const changeUserRole = async (userId: string, role: 'user' | 'operator' | 'admin'): Promise<User> => {
  const query = `
    UPDATE users
    SET role = $1, updated_at = NOW()
    WHERE user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [role, userId]);
  if (result.rows.length === 0) throw new NotFoundError('User not found');

  return result.rows[0];
};

// * Assign meter to user
export const assignMeterToUser = async (userId: string, meterId: string): Promise<User> => {
  try {
    const query = `
      UPDATE users
      SET meter_id = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [meterId, userId]);

    if (result.rows.length === 0) throw new NotFoundError('User not found');
    return result.rows[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === '23505') throw new ConflictError('Meter is already assigned to another user');
    throw error;
  }
};

// * Unassign meter from user
export const unassignMeterFromUser = async (userId: string): Promise<User> => {
  const query = `
    UPDATE users
    SET meter_id = NULL, updated_at = NOW()
    WHERE user_id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [userId]);
  if (result.rows.length === 0) throw new NotFoundError('User not found');

  return result.rows[0];
};

// * Delete user
export const deleteUser = async (userId: string): Promise<void> => {
  const query = 'DELETE FROM users WHERE user_id = $1';
  const result = await pool.query(query, [userId]);

  if (result.rowCount === 0) throw new NotFoundError('User not found');
};

// * Get all users with pagination and filters
export interface GetUsersFilters {
  role?: string;
  region?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const getUsers = async (filters: GetUsersFilters = {}) => {
  const { role, region, is_active, search, page = 1, limit = 50 } = filters;
  const conditions: string[] = [];
  const values: unknown[] = [];

  let paramCount = 1;
  if (role) {
    conditions.push(`role = $${paramCount++}`); values.push(role);
  }
  if (region) {
    conditions.push(`region = $${paramCount++}`); values.push(region);
  }
  if (is_active !== undefined) {
    conditions.push(`is_active = $${paramCount++}`); values.push(is_active);
  }
  if (search) {
    conditions.push(`(email ILIKE $${paramCount} OR name ILIKE $${paramCount})`);
    values.push(`%${search}%`);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count);

  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const dataQuery = `
    SELECT user_id, email, name, phone, role, meter_id, region, 
           email_verified, is_active, created_at, updated_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramCount++} OFFSET $${paramCount}
  `;

  const dataResult = await pool.query(dataQuery, values);
  return { users: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit), };
};
