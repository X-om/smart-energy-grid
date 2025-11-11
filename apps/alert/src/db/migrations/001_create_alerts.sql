-- Create alerts table for storing alert incidents
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    region VARCHAR(50),
    meter_id VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_region ON alerts(region);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_meter_id ON alerts(meter_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_status_timestamp ON alerts(status, timestamp);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
-- Drop trigger if it exists before recreating
DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at 
    BEFORE UPDATE ON alerts
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for active alerts
CREATE OR REPLACE VIEW active_alerts AS
SELECT * FROM alerts 
WHERE status = 'active' 
ORDER BY timestamp DESC;

-- Create view for alert statistics
CREATE OR REPLACE VIEW alert_stats AS
SELECT 
    type,
    region,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
    COUNT(CASE WHEN acknowledged = true THEN 1 END) as acknowledged_count,
    COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - timestamp))) as avg_resolution_time_seconds
FROM alerts
GROUP BY type, region;