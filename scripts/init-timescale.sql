-- Smart Energy Grid System - TimescaleDB Initialization
-- This script creates hypertables for time-series energy consumption data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ==========================================
-- RAW READINGS TABLE (Hypertable)
-- ==========================================
CREATE TABLE IF NOT EXISTS raw_readings (
    reading_id BIGSERIAL,
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    power_kw DECIMAL(12, 4),
    voltage DECIMAL(8, 2),
    current DECIMAL(8, 2),
    frequency DECIMAL(6, 2),
    power_factor DECIMAL(4, 2),
    temperature DECIMAL(6, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable with 1-day chunks
SELECT create_hypertable('raw_readings', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_raw_readings_meter ON raw_readings(meter_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_readings_region ON raw_readings(region, timestamp DESC);

-- ==========================================
-- 1-MINUTE AGGREGATES TABLE (Hypertable)
-- ==========================================
CREATE TABLE IF NOT EXISTS aggregates_1m (
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    avg_power_kw DECIMAL(12, 4),
    max_power_kw DECIMAL(12, 4),
    min_power_kw DECIMAL(12, 4),
    energy_kwh_sum DECIMAL(12, 4),
    voltage_avg DECIMAL(8, 2),
    current_avg DECIMAL(8, 2),
    reading_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable with 1-day chunks
SELECT create_hypertable('aggregates_1m', 'window_start',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agg_1m_meter ON aggregates_1m(meter_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_agg_1m_region ON aggregates_1m(region, window_start DESC);

-- ==========================================
-- 15-MINUTE AGGREGATES TABLE (Hypertable)
-- ==========================================
CREATE TABLE IF NOT EXISTS aggregates_15m (
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    avg_power_kw DECIMAL(12, 4),
    max_power_kw DECIMAL(12, 4),
    min_power_kw DECIMAL(12, 4),
    energy_kwh_sum DECIMAL(12, 4),
    voltage_avg DECIMAL(8, 2),
    current_avg DECIMAL(8, 2),
    reading_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hypertable with 7-day chunks
SELECT create_hypertable('aggregates_15m', 'window_start',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agg_15m_meter ON aggregates_15m(meter_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_agg_15m_region ON aggregates_15m(region, window_start DESC);

-- ==========================================
-- CONTINUOUS AGGREGATES
-- ==========================================

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
GROUP BY meter_id, region, window_start;

-- Add refresh policy (refresh last 2 hours every 1 minute)
SELECT add_continuous_aggregate_policy('cagg_1m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);

-- Create continuous aggregate for 15-minute windows from 1-minute aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_15m
WITH (timescaledb.continuous) AS
SELECT
    meter_id,
    region,
    time_bucket('15 minutes', window_start) AS window_start,
    AVG(avg_power_kw) AS avg_power_kw,
    MAX(max_power_kw) AS max_power_kw,
    MIN(min_power_kw) AS min_power_kw,
    SUM(energy_kwh_sum) AS energy_kwh_sum,
    AVG(voltage_avg) AS voltage_avg,
    AVG(current_avg) AS current_avg,
    SUM(reading_count) AS reading_count
FROM aggregates_1m
GROUP BY meter_id, region, window_start;

-- Add refresh policy (refresh last 1 day every 15 minutes)
SELECT add_continuous_aggregate_policy('cagg_15m',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE
);

-- ==========================================
-- DATA RETENTION POLICIES
-- ==========================================

-- Retain raw readings for 7 days
SELECT add_retention_policy('raw_readings', 
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Retain 1-minute aggregates for 30 days
SELECT add_retention_policy('aggregates_1m',
    INTERVAL '30 days',
    if_not_exists => TRUE
);

-- Retain 15-minute aggregates for 365 days
SELECT add_retention_policy('aggregates_15m',
    INTERVAL '365 days',
    if_not_exists => TRUE
);

-- ==========================================
-- COMPRESSION POLICIES
-- ==========================================

-- Enable compression on raw_readings (compress data older than 1 day)
ALTER TABLE raw_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id,region'
);

SELECT add_compression_policy('raw_readings',
    INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Enable compression on aggregates_1m (compress data older than 7 days)
ALTER TABLE aggregates_1m SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id,region'
);

SELECT add_compression_policy('aggregates_1m',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Enable compression on aggregates_15m (compress data older than 30 days)
ALTER TABLE aggregates_15m SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'meter_id,region'
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

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '✅ TimescaleDB initialized successfully!';
    RAISE NOTICE '⏱️  Hypertables created: raw_readings, aggregates_1m, aggregates_15m';
    RAISE NOTICE '📊 Continuous aggregates: cagg_1m, cagg_15m';
    RAISE NOTICE '♻️  Retention policies: 7d (raw), 30d (1m), 365d (15m)';
    RAISE NOTICE '🗜️  Compression enabled on all tables';
END $$;
