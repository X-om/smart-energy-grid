-- Create token blacklist table for logout functionality
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(100) PRIMARY KEY,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('access', 'refresh')),
    user_id VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);

-- Create cleanup function to remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM token_blacklist WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE token_blacklist IS 'Blacklisted JWT tokens for logout and revocation';
COMMENT ON COLUMN token_blacklist.jti IS 'JWT ID (unique identifier for each token)';
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Removes expired tokens from blacklist';
