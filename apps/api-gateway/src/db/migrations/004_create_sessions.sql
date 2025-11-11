-- Migration 004: Create Sessions and Token Blacklist Tables
-- JWT refresh token management and token revocation

-- Sessions table for refresh token management
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    access_token_jti VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON sessions(is_valid);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Token blacklist for logout functionality
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(100) PRIMARY KEY,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('access', 'refresh')),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100)
);

-- Indexes for token blacklist
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);

-- Cleanup function for expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM token_blacklist WHERE expires_at < NOW();
    DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE sessions IS 'Active user sessions with refresh tokens';
COMMENT ON TABLE token_blacklist IS 'Revoked JWT tokens (for logout and security)';
COMMENT ON COLUMN sessions.access_token_jti IS 'JWT ID of the associated access token';
COMMENT ON COLUMN sessions.is_valid IS 'Whether the session is still valid';
COMMENT ON FUNCTION cleanup_expired_tokens IS 'Remove expired tokens and sessions';

