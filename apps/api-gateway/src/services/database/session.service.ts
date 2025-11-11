import { pool } from '../../utils/db.js';
import { env } from '../../config/env.js';
import { NotFoundError } from '../../utils/errors.js';

export interface Session {
  session_id: string;
  user_id: string;
  refresh_token: string;
  access_token_jti: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_valid: boolean;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date;
}

export interface CreateSessionInput {
  userId: string;
  refreshToken: string;
  accessTokenJti?: string;
  ipAddress?: string;
  userAgent?: string;
}

// * Create a new session
export const createSession = async (input: CreateSessionInput): Promise<Session> => {
  const { userId, refreshToken, accessTokenJti, ipAddress, userAgent, } = input;
  const expiresAt = new Date(Date.now() + env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const query = `
    INSERT INTO sessions (user_id, refresh_token, access_token_jti, ip_address, user_agent, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await pool.query(query, [userId, refreshToken, accessTokenJti, ipAddress, userAgent, expiresAt]);
  return result.rows[0];
};

// * Get session by refresh token
export const getSessionByRefreshToken = async (refreshToken: string): Promise<Session | null> => {
  const query = 'SELECT * FROM sessions WHERE refresh_token = $1';
  const result = await pool.query(query, [refreshToken]);

  return result.rows[0] || null;
};

// * Get session by ID
export const getSessionById = async (sessionId: string): Promise<Session | null> => {
  const query = 'SELECT * FROM sessions WHERE session_id = $1';
  const result = await pool.query(query, [sessionId]);

  return result.rows[0] || null;
};

// * Get all active sessions for a user
export const getUserSessions = async (userId: string): Promise<Session[]> => {
  const query = `
    SELECT * FROM sessions
    WHERE user_id = $1 AND is_valid = true AND expires_at > NOW()
    ORDER BY last_used_at DESC
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
};

// * Update session's last used time
export const updateSessionLastUsed = async (sessionId: string): Promise<void> => {
  const query = `UPDATE sessions SET last_used_at = NOW() WHERE session_id = $1`;
  await pool.query(query, [sessionId]);
};

// * Update session's access token JTI
export const updateSessionAccessToken = async (sessionId: string, accessTokenJti: string): Promise<void> => {
  const query = `
    UPDATE sessions
    SET access_token_jti = $1, last_used_at = NOW()
    WHERE session_id = $2
  `;
  await pool.query(query, [accessTokenJti, sessionId]);
};

// * Invalidate a session
export const invalidateSession = async (sessionId: string): Promise<void> => {
  const query = `UPDATE sessions SET is_valid = false WHERE session_id = $1`;
  const result = await pool.query(query, [sessionId]);

  if (result.rowCount === 0) throw new NotFoundError('Session not found');
};

// * Invalidate session by refresh token
export const invalidateSessionByToken = async (refreshToken: string): Promise<void> => {
  const query = `UPDATE sessions SET is_valid = false WHERE refresh_token = $1`;
  const result = await pool.query(query, [refreshToken]);

  if (result.rowCount === 0) throw new NotFoundError('Session not found');
};

// * Invalidate all sessions for a user
export const invalidateAllUserSessions = async (userId: string): Promise<number> => {
  const query = `
    UPDATE sessions
    SET is_valid = false
    WHERE user_id = $1 AND is_valid = true
  `;
  const result = await pool.query(query, [userId]);
  return result.rowCount || 0;
};

// * Delete a session
export const deleteSession = async (sessionId: string): Promise<void> => {
  const query = 'DELETE FROM sessions WHERE session_id = $1';
  const result = await pool.query(query, [sessionId]);

  if (result.rowCount === 0)
    throw new NotFoundError('Session not found');
};

// * Clean up expired sessions
export const cleanupExpiredSessions = async (): Promise<number> => {
  const query = 'DELETE FROM sessions WHERE expires_at < NOW()';
  const result = await pool.query(query);
  return result.rowCount || 0;
};

// * Clean up invalid sessions older than X days
export const cleanupInvalidSessions = async (daysOld: number = 30): Promise<number> => {
  const query = `
    DELETE FROM sessions
    WHERE is_valid = false AND created_at < NOW() - INTERVAL '${daysOld} days'
  `;

  const result = await pool.query(query);
  return result.rowCount || 0;
};
