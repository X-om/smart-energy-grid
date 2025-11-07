#!/bin/bash

# Seed Database with Initial Data
# Usage: ./scripts/seed-db.sh

echo "🌱 Seeding database with initial data..."

POSTGRES_CONTAINER="segs-postgres"
DB_NAME="segs_db"
DB_USER="segs_user"

# Example seed SQL (placeholder)
SEED_SQL="
-- Create initial schema (placeholder)
CREATE TABLE IF NOT EXISTS meters (
  id SERIAL PRIMARY KEY,
  meter_id VARCHAR(50) UNIQUE NOT NULL,
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tariff_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rate_per_kwh DECIMAL(10, 4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO tariff_plans (name, rate_per_kwh, currency) 
VALUES 
  ('Residential Standard', 0.12, 'USD'),
  ('Commercial Peak', 0.18, 'USD'),
  ('Industrial Off-Peak', 0.08, 'USD')
ON CONFLICT DO NOTHING;

SELECT 'Database seeded successfully!' as result;
"

echo "$SEED_SQL" | docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME

echo "✅ Database seeding completed!"
