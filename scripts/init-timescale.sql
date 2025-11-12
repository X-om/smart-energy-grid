-- ================================================================
-- Smart Energy Grid System - TimescaleDB Initialization
-- ================================================================
-- This is the MASTER schema file for all TimescaleDB hypertables.
-- ALL services connect to this database with a unified schema.
-- DO NOT create migrations in individual services - update this file only.
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ==========================================
-- RAW READINGS TABLE (Hypertable)
-- ==========================================
-- Stores raw telemetry data from meters as it arrives
-- Data retention: 7 days (compressed after 1 day)

CREATE TABLE IF NOT EXISTS raw_readings (
    reading_id BIGSERIAL,
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    -- Power and energy measurements
    power_kw DECIMAL(12, 4),
    energy_kwh DECIMAL(12, 6),
    -- Electrical parameters
    voltage DECIMAL(8, 2),
    current DECIMAL(8, 2),
    frequency DECIMAL(6, 2),
    power_factor DECIMAL(4, 2),
    -- Environmental data
    temperature DECIMAL(6, 2),
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable with 1-day chunks (optimized for write throughput)
SELECT create_hypertable('raw_readings', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_raw_readings_meter ON raw_readings(meter_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_readings_region ON raw_readings(region, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_readings_timestamp ON raw_readings(timestamp DESC);

COMMENT ON TABLE raw_readings IS 'Raw telemetry readings from smart meters (7-day retention)';
COMMENT ON COLUMN raw_readings.power_kw IS 'Instantaneous power consumption in kilowatts';
COMMENT ON COLUMN raw_readings.current IS 'Calculated from power/voltage ratio';

-- ==========================================
-- 1-MINUTE AGGREGATES TABLE (Hypertable)
-- ==========================================
-- Stores 1-minute windowed aggregations from stream processor
-- Data retention: 30 days (compressed after 7 days)

CREATE TABLE IF NOT EXISTS aggregates_1m (
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    -- Power statistics
    avg_power_kw DECIMAL(12, 4),
    max_power_kw DECIMAL(12, 4),
    min_power_kw DECIMAL(12, 4),
    energy_kwh_sum DECIMAL(12, 4),
    -- Electrical parameters
    voltage_avg DECIMAL(8, 2),
    current_avg DECIMAL(8, 2),
    -- Metadata
    reading_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable with 1-day chunks
SELECT create_hypertable('aggregates_1m', 'window_start',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agg_1m_meter ON aggregates_1m(meter_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_agg_1m_region ON aggregates_1m(region, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_agg_1m_window ON aggregates_1m(window_start DESC);

-- Add unique constraint for upserts (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'aggregates_1m_unique_key' 
        AND conrelid = 'aggregates_1m'::regclass
    ) THEN
        ALTER TABLE aggregates_1m 
        ADD CONSTRAINT aggregates_1m_unique_key UNIQUE (meter_id, window_start);
    END IF;
END $$;

COMMENT ON TABLE aggregates_1m IS '1-minute aggregated data from stream processor (30-day retention)';
COMMENT ON COLUMN aggregates_1m.reading_count IS 'Number of raw readings in this 1-minute window';
COMMENT ON COLUMN aggregates_1m.energy_kwh_sum IS 'Total energy consumed in this 1-minute window';

-- ==========================================
-- 15-MINUTE AGGREGATES TABLE (Hypertable)
-- ==========================================
-- Stores 15-minute windowed aggregations from stream processor
-- Data retention: 365 days (compressed after 30 days)

CREATE TABLE IF NOT EXISTS aggregates_15m (
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    -- Power statistics
    avg_power_kw DECIMAL(12, 4),
    max_power_kw DECIMAL(12, 4),
    min_power_kw DECIMAL(12, 4),
    energy_kwh_sum DECIMAL(12, 4),
    -- Electrical parameters
    voltage_avg DECIMAL(8, 2),
    current_avg DECIMAL(8, 2),
    -- Metadata
    reading_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable with 7-day chunks (optimized for longer retention)
SELECT create_hypertable('aggregates_15m', 'window_start',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agg_15m_meter ON aggregates_15m(meter_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_agg_15m_region ON aggregates_15m(region, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_agg_15m_window ON aggregates_15m(window_start DESC);

-- Add unique constraint for upserts (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'aggregates_15m_unique_key' 
        AND conrelid = 'aggregates_15m'::regclass
    ) THEN
        ALTER TABLE aggregates_15m 
        ADD CONSTRAINT aggregates_15m_unique_key UNIQUE (meter_id, window_start);
    END IF;
END $$;

COMMENT ON TABLE aggregates_15m IS '15-minute aggregated data from stream processor (365-day retention)';
COMMENT ON COLUMN aggregates_15m.reading_count IS 'Number of raw readings in this 15-minute window';

-- ==========================================
-- CONTINUOUS AGGREGATES (Optional)
-- ==========================================
-- Note: Our stream processor handles aggregations in real-time from Kafka.
-- These continuous aggregates are backup/validation mechanisms.

-- Create continuous aggregate for 1-minute windows from raw data
CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_1m
WITH (timescaledb.continuous) AS
SELECT
    meter_id,
    region,
    time_bucket('1 minute', timestamp) AS window_start,
    AVG(power_kw) AS avg_power_kw,
    MAX(power_kw) AS max_power_kw,
    MIN(power_kw) AS min_power_kw,
    SUM(power_kw / 60.0) AS energy_kwh_sum,
    AVG(voltage) AS voltage_avg,
    AVG(current) AS current_avg,
    COUNT(*) AS reading_count
FROM raw_readings
GROUP BY meter_id, region, time_bucket('1 minute', timestamp);

-- Add refresh policy (refresh last 2 hours every 1 minute)
SELECT add_continuous_aggregate_policy('cagg_1m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);

COMMENT ON MATERIALIZED VIEW cagg_1m IS 'Continuous aggregate for validation (primary aggregation done by stream processor)';

-- ==========================================
-- DATA RETENTION POLICIES
-- ==========================================
-- Automatic cleanup of old data to manage storage costs

-- Retain raw readings for 7 days (high-resolution data has short lifespan)
SELECT add_retention_policy('raw_readings', 
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Retain 1-minute aggregates for 30 days (for recent dashboards)
SELECT add_retention_policy('aggregates_1m',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- Retain 15-minute aggregates for 365 days (for billing and long-term analysis)
SELECT add_retention_policy('aggregates_15m',
    INTERVAL '365 days',
    if_not_exists => TRUE
);

-- ==========================================
-- COMPRESSION POLICIES
-- ==========================================
-- Compress older data to reduce storage footprint

-- Enable compression on raw_readings (compress data older than 1 day)
ALTER TABLE raw_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id,region',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('raw_readings',
    INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Enable compression on aggregates_1m (compress data older than 7 days)
ALTER TABLE aggregates_1m SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id,region',
    timescaledb.compress_orderby = 'window_start DESC'
);

SELECT add_compression_policy('aggregates_1m',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Enable compression on aggregates_15m (compress data older than 30 days)
ALTER TABLE aggregates_15m SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id,region',
    timescaledb.compress_orderby = 'window_start DESC'
);

SELECT add_compression_policy('aggregates_15m',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO segs_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO segs_user;
GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA public TO segs_user;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '✅ TimescaleDB initialized successfully!';
    RAISE NOTICE '⏱️  Hypertables created:';
    RAISE NOTICE '   - raw_readings (7-day retention, 1-day compression)';
    RAISE NOTICE '   - aggregates_1m (30-day retention, 7-day compression)';
    RAISE NOTICE '   - aggregates_15m (365-day retention, 30-day compression)';
    RAISE NOTICE '📊 Continuous aggregates: cagg_1m';
    RAISE NOTICE '♻️  Retention policies configured for automatic cleanup';
    RAISE NOTICE '🗜️  Compression policies configured for storage optimization';
END $$;
