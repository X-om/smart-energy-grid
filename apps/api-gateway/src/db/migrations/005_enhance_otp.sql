-- Migration 005: Enhance OTP Verifications Table
-- Add purpose tracking, attempt counting, and verification timestamp

-- Add new columns to otp_verifications table
ALTER TABLE otp_verifications 
ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) NOT NULL DEFAULT 'email_verification',
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;

-- Add CHECK constraint for purpose
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'otp_purpose_check'
    ) THEN
        ALTER TABLE otp_verifications 
        ADD CONSTRAINT otp_purpose_check 
        CHECK (purpose IN ('email_verification', 'password_reset', 'login_2fa'));
    END IF;
END $$;

-- Add index for purpose queries
CREATE INDEX IF NOT EXISTS idx_otp_purpose ON otp_verifications(purpose);

-- Add index for efficient cleanup of old OTPs
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);

-- Cleanup function for expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_verifications WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON COLUMN otp_verifications.purpose IS 'Purpose of the OTP: email_verification, password_reset, or login_2fa';
COMMENT ON COLUMN otp_verifications.verified_at IS 'Timestamp when the OTP was successfully verified';
COMMENT ON COLUMN otp_verifications.attempts IS 'Number of verification attempts to prevent brute force';
COMMENT ON FUNCTION cleanup_expired_otps IS 'Remove expired OTP records';

