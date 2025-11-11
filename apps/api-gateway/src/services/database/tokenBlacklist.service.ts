import { pool } from '../../utils/db.js';

export interface BlacklistedToken {
  jti: string;
  token_type: 'access' | 'refresh';
  user_id: string | null;
  expires_at: Date;
  blacklisted_at: Date;
  reason: string | null;
}

// * Add token to blacklist
export const blacklistToken = async (jti: string, tokenType: 'access' | 'refresh', expiresAt: Date, userId?: string, reason?: string): Promise<void> => {
  const query = `
    INSERT INTO token_blacklist (jti, token_type, user_id, expires_at, reason)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (jti) DO NOTHING
  `;
  await pool.query(query, [jti, tokenType, userId, expiresAt, reason]);
};

// * Check if token is blacklisted
export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  const query = 'SELECT 1 FROM token_blacklist WHERE jti = $1';
  const result = await pool.query(query, [jti]);
  return result.rows.length > 0;
};

// * Get blacklisted token details
export const getBlacklistedToken = async (jti: string): Promise<BlacklistedToken | null> => {
  const query = 'SELECT * FROM token_blacklist WHERE jti = $1';
  const result = await pool.query(query, [jti]);
  return result.rows[0] || null;
};

// * Clean up expired blacklisted tokens
export const cleanupExpiredBlacklistedTokens = async (): Promise<number> => {
  const query = 'DELETE FROM token_blacklist WHERE expires_at < NOW()';
  const result = await pool.query(query);
  return result.rowCount || 0;
};

// * Blacklist all tokens for a user
export const blacklistAllUserTokens = async (userId: string, _reason?: string): Promise<void> => {
  // This would typically be called when user changes password or account is compromised
  // In practice, we'd need to fetch all active sessions and blacklist their tokens
  // For now, we'll just invalidate all sessions (handled by session service)

  // Note: This is a placeholder. In production, you might want to:
  // 1. Get all active sessions for user
  // 2. Extract JTIs from sessions
  // 3. Blacklist each token

  // For simplicity, we're relying on session invalidation
  console.log(`Blacklisting all tokens for user ${userId}`);
};
