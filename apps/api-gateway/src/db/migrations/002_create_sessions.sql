-- Create sessions table for JWT refresh token management
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    access_token_jti VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON sessions(is_valid);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Add foreign key constraint to users table
ALTER TABLE sessions 
ADD CONSTRAINT fk_sessions_user 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

COMMENT ON TABLE sessions IS 'User sessions for JWT refresh token management';
COMMENT ON COLUMN sessions.access_token_jti IS 'JWT ID for tracking access tokens';
COMMENT ON COLUMN sessions.is_valid IS 'Whether the session is still valid (for logout)';
