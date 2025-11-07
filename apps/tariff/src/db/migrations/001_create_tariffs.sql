-- Tariff Pricing Table
-- Stores all tariff updates with historical tracking

CREATE TABLE IF NOT EXISTS tariffs (
  tariff_id UUID PRIMARY KEY,
  region TEXT NOT NULL,
  price_per_kwh DOUBLE PRECISION NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  reason TEXT,
  triggered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying current tariff by region
CREATE INDEX IF NOT EXISTS idx_tariffs_region_effective ON tariffs(region, effective_from DESC);

-- Index for historical queries
CREATE INDEX IF NOT EXISTS idx_tariffs_created_at ON tariffs(created_at DESC);

-- Index for filtering by trigger type
CREATE INDEX IF NOT EXISTS idx_tariffs_triggered_by ON tariffs(triggered_by);
