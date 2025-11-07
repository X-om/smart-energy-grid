# 🚀 SEGS Deployment Guide

Complete deployment guide for the Smart Energy Grid Management System.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Service Overview](#service-overview)
3. [Database Setup](#database-setup)
4. [Kafka Topics](#kafka-topics)
5. [Monitoring](#monitoring)
6. [Testing the System](#testing-the-system)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Build All Services

```bash
pnpm turbo build
```

### 2. Start Docker Stack

```bash
docker compose up -d
```

This starts all infrastructure and microservices:
- ✅ Zookeeper & Kafka
- ✅ PostgreSQL & TimescaleDB  
- ✅ Redis
- ✅ Prometheus & Grafana
- ✅ 7 Microservices (API Gateway, Ingestion, Stream Processor, Tariff, Alert, Notification, Simulator)

### 3. Initialize Kafka Topics

```bash
./scripts/create-topics.sh
```

Creates 6 topics:
- `raw_readings` - Raw telemetry
- `aggregates_1m` - 1-minute aggregates
- `aggregates_15m` - 15-minute aggregates
- `tariff_updates` - Tariff changes
- `alerts` - Anomaly alerts
- `alerts_processed` - Processed alerts

### 4. Seed Database

```bash
./scripts/seed-db.sh
```

Inserts:
- 4 test users (USER/OPERATOR/ADMIN roles)
- 5 meters across 3 regions
- 6 tariff plans (peak/off-peak pricing)
- 4 tariff rules for dynamic pricing

**Test Credentials** (password: `password123`):
- `user@example.com`
- `operator@example.com`
- `admin@example.com`

### 5. Run Simulator

```bash
# Default: 100 meters, 5s interval
./scripts/run-simulator.sh

# Custom configuration
./scripts/run-simulator.sh --meters 500 --interval 10000 --batch-size 100
```

### 6. Health Check

```bash
./scripts/health-check.sh
```

---

## Service Overview

### 🌐 API Gateway (Port 3000)

**Swagger UI:** http://localhost:3000/docs

**Key Endpoints:**
```bash
# Authentication
POST /auth/login
POST /auth/register
POST /auth/token/generate

# User APIs
GET /api/users/me
GET /api/users/me/consumption?granularity=1m&limit=100
GET /api/users/me/tariff/current
GET /api/users/me/alerts

# Billing
GET /api/billing/invoices
GET /api/billing/invoice/:id
GET /api/billing/summary

# Operator (requires OPERATOR/ADMIN role)
GET /api/operator/alerts
GET /api/operator/grid/load
POST /api/operator/tariff/override
GET /api/operator/statistics
```

**Example: Login**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 📥 Ingestion Service (Port 3001)

**Health:** http://localhost:3001/health  
**Metrics:** http://localhost:3001/metrics

**Endpoints:**
```bash
# Single reading
POST /telemetry
{
  "meterId": "METER-001",
  "timestamp": "2024-01-01T12:00:00Z",
  "powerKw": 5.2,
  "voltage": 230.5,
  "current": 22.6
}

# Batch readings (recommended)
POST /telemetry/batch
[
  { "meterId": "METER-001", ... },
  { "meterId": "METER-002", ... }
]
```

### ⚡ Stream Processor (Port 3002)

**Metrics:** http://localhost:3002/metrics

**Function:**
- Consumes `raw_readings` from Kafka
- Creates 1-minute and 15-minute aggregates
- Stores in TimescaleDB hypertables
- Detects anomalies and triggers alerts

### 💰 Tariff Service (Port 3003)

**Health:** http://localhost:3003/health

**Features:**
- Peak/off-peak pricing
- Regional tariff variations
- Rule-based dynamic pricing
- Redis caching (60s TTL)

### 🚨 Alert Service (Port 3004)

**Metrics:** http://localhost:3004/metrics  
**Dashboard:** http://localhost:3004/operator/alerts

**Alert Types:**
- `OVERLOAD` - Exceeds consumption threshold
- `ANOMALY` - Statistical outlier
- `GRID_FAILURE` - Connectivity issues
- `TARIFF_SPIKE` - Sudden price increase

### 📢 Notification Service (Port 3005)

**Health:** http://localhost:3005/health  
**WebSocket:** ws://localhost:3005/ws?token=<JWT>

**Test WebSocket:**
```bash
# Install wscat: npm install -g wscat
wscat -c "ws://localhost:3005/ws?token=YOUR_JWT_TOKEN"
```

### 🔌 Simulator

**Run via Docker Compose:**
```bash
docker compose --profile simulator up
```

**Run standalone:**
```bash
./scripts/run-simulator.sh --meters 1000 --interval 5000
```

---

## Database Setup

### PostgreSQL (Port 5432)

**Schema initialized automatically** via `scripts/init-db.sql`

**Tables:**
- `users` - User accounts
- `meters` - Smart meters
- `tariffs` - Tariff plans
- `tariff_rules` - Dynamic pricing rules
- `alerts` - Alert history
- `invoices` - Billing invoices
- `invoice_line_items` - Invoice details
- `audit_logs` - Audit trail

**Connect:**
```bash
docker exec -it segs-postgres psql -U segs_user -d segs_db

# Example queries
SELECT COUNT(*) FROM users;
SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10;
SELECT region, COUNT(*) FROM meters GROUP BY region;
```

### TimescaleDB (Port 5433)

**Hypertables initialized** via `scripts/init-timescale.sql`

**Hypertables:**
- `raw_readings` - Raw telemetry (7-day retention)
- `aggregates_1m` - 1-minute aggregates (30-day retention)
- `aggregates_15m` - 15-minute aggregates (365-day retention)

**Continuous Aggregates:**
- `cagg_1m` - Auto-refresh every 1 minute
- `cagg_15m` - Auto-refresh every 15 minutes

**Connect:**
```bash
docker exec -it segs-timescaledb psql -U segs_user -d segs_db

# Example queries
SELECT COUNT(*) FROM raw_readings;
SELECT meter_id, AVG(avg_power_kw) FROM aggregates_1m 
  WHERE window_start > NOW() - INTERVAL '1 hour'
  GROUP BY meter_id;
```

### Redis (Port 6379)

**Usage:**
- Tariff caching
- Ingestion deduplication
- Session management

**Connect:**
```bash
docker exec -it segs-redis redis-cli

# Example commands
KEYS tariff:*
GET tariff:Pune-West
KEYS reading:*
```

---

## Kafka Topics

### View Topics

**Kafka UI:** http://localhost:8080

**CLI:**
```bash
docker exec -it segs-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

### Consume Messages

```bash
# Raw readings
docker exec -it segs-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic raw_readings \
  --from-beginning \
  --max-messages 10

# Alerts
docker exec -it segs-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic alerts \
  --from-beginning
```

---

## Monitoring

### Prometheus (Port 9090)

**Access:** http://localhost:9090

**Example Queries:**
```promql
# Request rate per service
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Kafka message throughput
rate(kafka_messages_produced_total[1m])
```

### Grafana (Port 3006)

**Access:** http://localhost:3006  
**Login:** admin / admin

**Create Dashboard:**
1. Add Prometheus datasource (already configured)
2. Import dashboard or create custom panels
3. Suggested metrics:
   - API Gateway request rates
   - Service response times
   - Kafka lag by consumer group
   - Database connection pool usage

---

## Testing the System

### 1. Login & Get JWT Token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"
```

### 2. Test User APIs

```bash
# Get user profile
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users/me | jq .

# Get consumption data
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/users/me/consumption?granularity=1m&limit=10" | jq .

# Get current tariff
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users/me/tariff/current | jq .

# Get alerts
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users/me/alerts | jq .
```

### 3. Test Operator APIs (OPERATOR role required)

```bash
# Login as operator
OP_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@example.com","password":"password123"}' \
  | jq -r '.data.token')

# Get all alerts
curl -H "Authorization: Bearer $OP_TOKEN" \
  http://localhost:3000/api/operator/alerts | jq .

# Get grid load
curl -H "Authorization: Bearer $OP_TOKEN" \
  http://localhost:3000/api/operator/grid/load | jq .

# Get statistics
curl -H "Authorization: Bearer $OP_TOKEN" \
  http://localhost:3000/api/operator/statistics | jq .
```

### 4. Test Ingestion

```bash
# Single reading
curl -X POST http://localhost:3001/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "meterId": "METER-001",
    "region": "Pune-West",
    "timestamp": "2024-01-01T12:00:00Z",
    "powerKw": 5.2,
    "voltage": 230.5,
    "current": 22.6
  }'
```

### 5. Monitor Real-time via WebSocket

```bash
# Install wscat if needed: npm install -g wscat
wscat -c "ws://localhost:3005/ws?token=$TOKEN"

# You'll receive real-time alerts and updates
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f <service-name>

# Restart specific service
docker compose restart api-gateway

# Full restart
docker compose down && docker compose up -d
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker exec segs-postgres pg_isready -U segs_user -d segs_db

# Check TimescaleDB
docker exec segs-timescaledb pg_isready -U segs_user -d segs_db

# View PostgreSQL logs
docker logs segs-postgres
```

### Kafka Issues

```bash
# Check Kafka health
docker exec segs-kafka kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092

# Recreate topics
./scripts/create-topics.sh

# View Kafka logs
docker logs segs-kafka
```

### Redis Issues

```bash
# Test Redis connection
docker exec segs-redis redis-cli PING

# View Redis logs
docker logs segs-redis
```

### Port Conflicts

If ports are already in use:

```yaml
# Edit docker-compose.yml and change port mappings:
ports:
  - "3100:3000"  # Instead of 3000:3000
```

### Clear All Data

```bash
# Stop and remove everything including volumes
docker compose down -v

# Remove all images
docker compose down --rmi all

# Start fresh
docker compose up -d
./scripts/create-topics.sh
./scripts/seed-db.sh
```

---

## Production Considerations

### Security
- [ ] Change default passwords
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Enable TLS for all services
- [ ] Set up firewall rules
- [ ] Implement rate limiting per user
- [ ] Add API key authentication

### Scalability
- [ ] Horizontal scaling for stateless services
- [ ] Kafka partition tuning
- [ ] Database connection pooling optimization
- [ ] Redis clustering
- [ ] Load balancer (nginx, HAProxy)

### Reliability
- [ ] Multi-replica Kafka brokers
- [ ] Database replication (master-slave)
- [ ] Health checks and auto-restart
- [ ] Circuit breakers
- [ ] Retry logic with exponential backoff

### Monitoring
- [ ] Set up alerting rules in Prometheus
- [ ] Configure Grafana notifications
- [ ] Log aggregation (ELK, Loki)
- [ ] Distributed tracing (Jaeger, Zipkin)
- [ ] APM integration (Datadog, New Relic)

---

**🎉 Your Smart Energy Grid System is now fully operational!**
