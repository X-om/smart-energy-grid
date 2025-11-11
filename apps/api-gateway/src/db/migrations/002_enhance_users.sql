-- Migration 002: Enhance Users Table
-- Add account management and tracking fields

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add CHECK constraint for region if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_region_check'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_region_check 
        CHECK (region IN ('Mumbai-North', 'Mumbai-South', 'Delhi-North', 'Delhi-South', 'Bangalore-East', 'Bangalore-West', 'Pune-East', 'Pune-West', 'Hyderabad-Central', 'Chennai-North'));
    END IF;
END $$;

-- Add index for is_active field
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add index for last_login tracking
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);

-- Comments
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active or suspended';
COMMENT ON COLUMN users.suspended_at IS 'Timestamp when the account was suspended';
COMMENT ON COLUMN users.suspended_reason IS 'Reason for account suspension';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';

