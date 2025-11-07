# API Gateway Testing Guide

## Prerequisites

Before starting the API Gateway, ensure the following services are running:

1. **PostgreSQL** (port 5432)
2. **Redis** (port 6379)
3. **TimescaleDB** (same as PostgreSQL)

## Database Schema

The API Gateway expects the following tables to exist in PostgreSQL:

### Users Table
```sql
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'OPERATOR', 'ADMIN')),
  region VARCHAR(100),
  meter_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_region ON users(region);
```

### Tariffs Table
```sql
CREATE TABLE IF NOT EXISTS tariffs (
  tariff_id VARCHAR(50) PRIMARY KEY,
  region VARCHAR(100) NOT NULL,
  time_of_day VARCHAR(20),
  price_per_kwh DECIMAL(10, 2) NOT NULL,
  effective_from TIMESTAMP NOT NULL,
  effective_to TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tariffs_region ON tariffs(region);
CREATE INDEX idx_tariffs_active ON tariffs(is_active, effective_from);
```

### Invoices Table
```sql
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  total_kwh DECIMAL(12, 2) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')),
  due_date TIMESTAMP,
  paid_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

### Invoice Line Items Table
```sql
CREATE TABLE IF NOT EXISTS invoice_line_items (
  line_item_id VARCHAR(50) PRIMARY KEY,
  invoice_id VARCHAR(50) REFERENCES invoices(invoice_id),
  description TEXT,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  kwh_consumed DECIMAL(12, 2) NOT NULL,
  rate_per_kwh DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
```

### Alerts Table (should already exist from Alert Service)
```sql
-- Already created by Alert Service
-- CREATE TABLE alerts (...)
```

## Setup Instructions

### 1. Create Database Tables

```bash
# Connect to PostgreSQL
docker exec -i segs-postgres psql -U segs_user -d segs_db << EOF
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'OPERATOR', 'ADMIN')),
  region VARCHAR(100),
  meter_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);

-- Create tariffs table  
CREATE TABLE IF NOT EXISTS tariffs (
  tariff_id VARCHAR(50) PRIMARY KEY,
  region VARCHAR(100) NOT NULL,
  time_of_day VARCHAR(20),
  price_per_kwh DECIMAL(10, 2) NOT NULL,
  effective_from TIMESTAMP NOT NULL,
  effective_to TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tariffs_region ON tariffs(region);
CREATE INDEX IF NOT EXISTS idx_tariffs_active ON tariffs(is_active, effective_from);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  total_kwh DECIMAL(12, 2) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')),
  due_date TIMESTAMP,
  paid_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Create invoice line items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  line_item_id VARCHAR(50) PRIMARY KEY,
  invoice_id VARCHAR(50) REFERENCES invoices(invoice_id),
  description TEXT,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  kwh_consumed DECIMAL(12, 2) NOT NULL,
  rate_per_kwh DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);
EOF
```

### 2. Seed Test Data

```bash
# Insert a test user
docker exec -i segs-postgres psql -U segs_user -d segs_db << EOF
INSERT INTO users (user_id, email, password_hash, name, role, region, meter_id)
VALUES 
  ('USR-001', 'user@example.com', '\$2b\$10\$YourHashedPasswordHere', 'Om Argade', 'USER', 'Pune-West', 'METER-001'),
  ('USR-002', 'operator@example.com', '\$2b\$10\$YourHashedPasswordHere', 'Operator User', 'OPERATOR', 'Pune-West', NULL),
  ('USR-003', 'admin@example.com', '\$2b\$10\$YourHashedPasswordHere', 'Admin User', 'ADMIN', NULL, NULL)
ON CONFLICT (user_id) DO NOTHING;
EOF
```

### 3. Start the API Gateway

```bash
cd /tmp/smart-energy-grid/apps/api-gateway
pnpm dev
```

## Testing the API

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Generate JWT Token (for testing)
```bash
curl -X POST http://localhost:3000/auth/token/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USR-001",
    "role": "USER",
    "email": "user@example.com",
    "name": "Om Argade",
    "region": "Pune-West",
    "meterId": "METER-001"
  }'
```

### 3. Test User Profile
```bash
TOKEN="your-jwt-token-here"

curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Test Consumption Data
```bash
curl "http://localhost:3000/api/users/me/consumption?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z&granularity=1m" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Test Current Tariff
```bash
curl http://localhost:3000/api/users/me/tariff/current \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Test Operator Endpoints (requires OPERATOR or ADMIN role)
```bash
OPERATOR_TOKEN="operator-jwt-token"

# Get all alerts
curl http://localhost:3000/api/operator/alerts \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Get grid load statistics
curl "http://localhost:3000/api/operator/grid/load?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Get system statistics
curl http://localhost:3000/api/operator/statistics \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

## API Documentation

Once the service is running, visit:
```
http://localhost:3000/docs
```

This will open the Swagger UI with complete API documentation.

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check connection string in `.env` file
- Test connection: `docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT 1"`

### Redis Connection Issues
- Verify Redis is running: `docker ps | grep redis`
- Test connection: `docker exec segs-redis redis-cli ping`

### Port Already in Use
```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill -9
```

### View Logs
```bash
# If running in background
tail -f api-gateway.log

# If running in foreground, logs will appear in terminal
```
