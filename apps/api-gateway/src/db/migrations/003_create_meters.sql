-- Migration 003: Create Meters Table
-- Core infrastructure for smart meter management

CREATE TABLE IF NOT EXISTS meters (
    meter_id VARCHAR(50) PRIMARY KEY,
    region VARCHAR(50) NOT NULL CHECK (region IN ('north', 'south', 'east', 'west', 'central')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
           CHECK (status IN ('active', 'inactive', 'maintenance', 'faulty', 'decommissioned')),
    installation_date TIMESTAMP WITH TIME ZONE,
    last_reading_at TIMESTAMP WITH TIME ZONE,
    last_reading_value DOUBLE PRECISION,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_meters_region ON meters(region);
CREATE INDEX IF NOT EXISTS idx_meters_status ON meters(status);
CREATE INDEX IF NOT EXISTS idx_meters_last_reading_at ON meters(last_reading_at DESC);

-- Add foreign key constraint to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_meter_id_fkey'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_meter_id_fkey 
        FOREIGN KEY (meter_id) REFERENCES meters(meter_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_meters_updated_at ON meters;
CREATE TRIGGER update_meters_updated_at
    BEFORE UPDATE ON meters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE meters IS 'Smart meter infrastructure and metadata';
COMMENT ON COLUMN meters.meter_id IS 'Unique meter identifier';
COMMENT ON COLUMN meters.status IS 'Current operational status of the meter';
COMMENT ON COLUMN meters.last_reading_value IS 'Cached latest reading value for quick access';
COMMENT ON COLUMN meters.metadata IS 'Flexible JSON field for meter-specific data (model, firmware, etc.)';

