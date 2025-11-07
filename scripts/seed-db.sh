#!/bin/bash

# Smart Energy Grid System - Database Seeding Script
# Seeds initial test data into PostgreSQL

set -e

echo "🌱 Seeding PostgreSQL database with initial data..."
echo ""

# Get Postgres container name
POSTGRES_CONTAINER=$(docker ps --filter "name=segs-postgres" --format "{{.Names}}" | head -n 1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "❌ Error: PostgreSQL container not found. Is Docker Compose running?"
    echo "   Run: docker-compose up -d"
    exit 1
fi

echo "✅ Found PostgreSQL container: $POSTGRES_CONTAINER"
echo ""

# Seed data
echo "📝 Inserting test data..."

docker exec -i "$POSTGRES_CONTAINER" psql -U segs_user -d segs_db <<'SQL'

-- ==========================================
-- SEED TEST USERS
-- ==========================================

-- Password for all test users: "password123"
-- Hash generated with bcrypt, rounds=10
INSERT INTO users (user_id, email, password_hash, name, role, region, meter_id)
VALUES 
    ('USR-001', 'user@example.com', '$2b$10$YKEVZzEKqOqVR5rXVJ1xD.vHxKbJXPFQJm0vqQyPc8QZxK0tJJ8sW', 'John Doe', 'USER', 'Pune-West', 'METER-001'),
    ('USR-002', 'jane@example.com', '$2b$10$YKEVZzEKqOqVR5rXVJ1xD.vHxKbJXPFQJm0vqQyPc8QZxK0tJJ8sW', 'Jane Smith', 'USER', 'Pune-East', 'METER-002'),
    ('OPR-001', 'operator@example.com', '$2b$10$YKEVZzEKqOqVR5rXVJ1xD.vHxKbJXPFQJm0vqQyPc8QZxK0tJJ8sW', 'Operator One', 'OPERATOR', 'Pune-West', NULL),
    ('ADM-001', 'admin@example.com', '$2b$10$YKEVZzEKqOqVR5rXVJ1xD.vHxKbJXPFQJm0vqQyPc8QZxK0tJJ8sW', 'Admin User', 'ADMIN', NULL, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ==========================================
-- SEED METERS
-- ==========================================

INSERT INTO meters (meter_id, user_id, region, status)
VALUES 
    ('METER-001', 'USR-001', 'Pune-West', 'ACTIVE'),
    ('METER-002', 'USR-002', 'Pune-East', 'ACTIVE'),
    ('METER-003', NULL, 'Pune-West', 'ACTIVE'),
    ('METER-004', NULL, 'Pune-East', 'ACTIVE'),
    ('METER-005', NULL, 'Mumbai-North', 'ACTIVE')
ON CONFLICT (meter_id) DO NOTHING;

-- ==========================================
-- SEED TARIFFS
-- ==========================================

INSERT INTO tariffs (tariff_id, region, time_of_day, price_per_kwh, effective_from, is_active)
VALUES 
    ('TARIFF-001', 'Pune-West', 'peak', 8.50, NOW() - INTERVAL '7 days', true),
    ('TARIFF-002', 'Pune-West', 'off-peak', 5.00, NOW() - INTERVAL '7 days', true),
    ('TARIFF-003', 'Pune-East', 'peak', 9.00, NOW() - INTERVAL '7 days', true),
    ('TARIFF-004', 'Pune-East', 'off-peak', 5.50, NOW() - INTERVAL '7 days', true),
    ('TARIFF-005', 'Mumbai-North', 'peak', 10.00, NOW() - INTERVAL '7 days', true),
    ('TARIFF-006', 'Mumbai-North', 'off-peak', 6.00, NOW() - INTERVAL '7 days', true)
ON CONFLICT (tariff_id) DO NOTHING;

-- ==========================================
-- SEED TARIFF RULES
-- ==========================================

INSERT INTO tariff_rules (rule_id, region, rule_type, conditions, base_price, multiplier, priority, is_active)
VALUES 
    ('RULE-001', 'Pune-West', 'peak_hour', '{"hours": [10, 11, 18, 19, 20]}', 7.00, 1.5, 10, true),
    ('RULE-002', 'Pune-West', 'weekend', '{"days": [0, 6]}', 5.00, 0.8, 5, true),
    ('RULE-003', 'Pune-East', 'high_load', '{"load_threshold": 1000}', 8.00, 1.8, 15, true),
    ('RULE-004', 'Mumbai-North', 'peak_hour', '{"hours": [9, 10, 17, 18, 19, 20]}', 8.50, 1.6, 10, true)
ON CONFLICT (rule_id) DO NOTHING;

-- ==========================================
-- DISPLAY SEEDED DATA
-- ==========================================

\echo ''
\echo '✅ Database seeded successfully!'
\echo ''
\echo '📊 Seeded Data Summary:'
\echo ''

SELECT 'Users' AS entity, COUNT(*) AS count FROM users
UNION ALL
SELECT 'Meters', COUNT(*) FROM meters
UNION ALL
SELECT 'Tariffs', COUNT(*) FROM tariffs
UNION ALL
SELECT 'Tariff Rules', COUNT(*) FROM tariff_rules;

\echo ''
\echo '👤 Test User Accounts:'
\echo ''

SELECT 
    user_id,
    name,
    email,
    role,
    region
FROM users
ORDER BY role, user_id;

\echo ''
\echo '🔑 Login Credentials (password for all users: password123):'
\echo '   User:     user@example.com'
\echo '   Operator: operator@example.com'
\echo '   Admin:    admin@example.com'
\echo ''

SQL

echo ""
echo "✅ Database seeding complete!"
echo ""
echo "📝 You can now:"
echo "   1. Login to API Gateway: http://localhost:3000/docs"
echo "   2. Generate JWT tokens for testing"
echo "   3. View data in pgAdmin or similar tools"
echo ""
