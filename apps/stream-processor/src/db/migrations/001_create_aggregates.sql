-- Create aggregates_1m table (1-minute window aggregates)
-- NOTE: min_power_kw, voltage_avg, current_avg are not currently calculated by stream processor
-- They have DEFAULT 0 for future enhancement without schema changes
CREATE TABLE IF NOT EXISTS aggregates_1m (
    meter_id TEXT NOT NULL,
    region TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    avg_power_kw DOUBLE PRECISION NOT NULL,
    max_power_kw DOUBLE PRECISION NOT NULL,
    min_power_kw DOUBLE PRECISION DEFAULT 0,
    energy_kwh_sum DOUBLE PRECISION NOT NULL,
    voltage_avg DOUBLE PRECISION DEFAULT 0,
    current_avg DOUBLE PRECISION DEFAULT 0,
    count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (meter_id, window_start)
);

SELECT create_hypertable('aggregates_1m', 'window_start', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_aggregates_1m_region_time ON aggregates_1m (region, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_aggregates_1m_meter_time ON aggregates_1m (meter_id, window_start DESC);

-- Create aggregates_15m table (15-minute window aggregates)
-- NOTE: min_power_kw, voltage_avg, current_avg are not currently calculated by stream processor
-- They have DEFAULT 0 for future enhancement without schema changes
CREATE TABLE IF NOT EXISTS aggregates_15m (
    meter_id TEXT NOT NULL,
    region TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    avg_power_kw DOUBLE PRECISION NOT NULL,
    max_power_kw DOUBLE PRECISION NOT NULL,
    min_power_kw DOUBLE PRECISION DEFAULT 0,
    energy_kwh_sum DOUBLE PRECISION NOT NULL,
    voltage_avg DOUBLE PRECISION DEFAULT 0,
    current_avg DOUBLE PRECISION DEFAULT 0,
    count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (meter_id, window_start)
);
SELECT create_hypertable('aggregates_15m', 'window_start', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_aggregates_15m_region_time ON aggregates_15m (region, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_aggregates_15m_meter_time ON aggregates_15m (meter_id, window_start DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS aggregates_1m_by_region 
WITH (timescaledb.continuous) AS
SELECT 
    region,
    time_bucket('1 minute', window_start) AS bucket,
    AVG(avg_power_kw) as avg_power_kw,
    MAX(max_power_kw) as max_power_kw,
    SUM(energy_kwh_sum) as total_energy_kwh,
    SUM(count) as total_count
FROM aggregates_1m
GROUP BY region, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('aggregates_1m_by_region',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE);

SELECT add_retention_policy('aggregates_1m', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('aggregates_15m', INTERVAL '180 days', if_not_exists => TRUE);
