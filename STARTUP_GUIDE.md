# Smart Energy Grid System - Startup Guide

## Prerequisites
- Docker and Docker Compose installed
- Node.js v18+ and pnpm installed
- All dependencies installed: `pnpm install`

---

## ✅ System Ready!

All infrastructure services are **RUNNING** and databases have been **RESET**:
- ✅ Zookeeper (port 2181)
- ✅ Kafka (ports 9092, 29092)
- ✅ Redis (port 6379)
- ✅ PostgreSQL (port 5432)
- ✅ TimescaleDB (port 5433)

**Kafka Topics Created:**
- `raw_readings` (for ingestion)
- `aggregates_1m_regional` (regional 1-min aggregates)
- `aggregates_15m` (15-min aggregates)
- `regional_aggregates_1m` (regional stats)
- `alerts` (alert events)
- `alerts_processed` (processed alerts)
- `tariff_updates` (pricing updates)

**Database Status:**
- All data cleared
- Tables recreated with proper schema
- TimescaleDB hypertables configured
- Continuous aggregates enabled
- Retention policies active

---

## 🚀 Quick Start

### Automated Startup (Recommended)

Start all services with one command:

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
./START_SERVICES.sh
```

This will:
- ✅ Start all services in the correct order
- ✅ Run them in background
- ✅ Save logs to `/tmp/segs-logs/`
- ✅ Display process IDs (PIDs)

**View service logs:**
```bash
tail -f /tmp/segs-logs/stream-processor.log
tail -f /tmp/segs-logs/alert.log
tail -f /tmp/segs-logs/api-gateway.log
# ... etc
```

**Stop all services:**
```bash
./STOP_SERVICES.sh
```

---

## Microservice Startup Order

**For manual startup or development, start each service in a separate terminal:**

### 1. Stream Processor (First)
**Purpose:** Processes raw telemetry data from Kafka and generates aggregates

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter stream-processor start
```

**What it does:**
- Consumes from: `raw_readings`
- Produces to: `aggregates_1m_regional`, `regional_aggregates_1m`, `aggregates_15m`
- Calculates: 1-min, 15-min regional aggregates
- Port: 3002 (metrics endpoint)
- Metrics: http://localhost:3002/metrics

**Wait:** 10 seconds for Kafka consumer groups to initialize

---

### 2. Alert Service (Second)
**Purpose:** Monitors telemetry data and generates alerts

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter alert start
```

**What it does:**
- Consumes from: `raw_readings`, `aggregates_1m_regional`
- Produces to: `alerts`, `alerts_processed`
- Stores alerts in: PostgreSQL
- Port: 3004
- Health: http://localhost:3004/health

**Wait:** 10 seconds for database connections and Kafka consumers

---

### 3. Tariff Service (Third)
**Purpose:** Manages dynamic pricing based on demand

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter tariff start
```

**What it does:**
- Consumes from: `aggregates_1m_regional`
- Produces to: `tariff_updates`
- Stores tariffs in: PostgreSQL
- Updates pricing every 15 minutes
- Port: 3005
- Health: http://localhost:3005/health

**Wait:** 5 seconds for database initialization

---

### 4. Notification Service (Fourth)
**Purpose:** Sends notifications for alerts and events

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter notification start
```

**What it does:**
- Consumes from: `alerts_processed`
- Sends: Email/SMS notifications (configured)
- Port: 3003
- Health: http://localhost:3003/health

**Wait:** 5 seconds

---

### 5. API Gateway (Fifth)
**Purpose:** Main REST API for client applications

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter api-gateway start
```

**What it does:**
- Serves REST API on port 3000
- Connects to: PostgreSQL, TimescaleDB, Redis
- Provides: Auth, User, Telemetry, Tariff, Alert APIs
- Port: 3000
- Health: http://localhost:3000/health
- API Docs: See `API_RESPONSES.md`

**Wait:** 10 seconds for database migrations and connections

---

### 6. Ingestion Service (Sixth)
**Purpose:** Receives telemetry data from IoT devices

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter ingestion start
```

**What it does:**
- Receives telemetry via HTTP POST
- Validates and publishes to: `raw_readings` Kafka topic
- Port: 3001
- Health: http://localhost:3001/health

**Wait:** 5 seconds

---

### 7. Simulator (Last - Optional)
**Purpose:** Generates simulated meter readings for testing

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm --filter simulator start
```

**What it does:**
- Generates realistic meter readings
- Sends to: Ingestion Service (http://localhost:3001)
- Simulates: Multiple meters across regions
- Can run in: dry-run mode (no actual sending)

**Configuration:**
- Edit `apps/simulator/src/config.ts` for simulation parameters
- Regions: NORTH, SOUTH, EAST, WEST, CENTRAL
- Default: 10 meters per region

---

## Quick Start Script

For convenience, start all services in order:

```bash
cd /Users/om/Projects/SMART-ENERGY-GRID

# Terminal 1: Stream Processor
pnpm --filter stream-processor start

# Terminal 2: Alert Service (wait 10s)
sleep 10 && pnpm --filter alert start

# Terminal 3: Tariff Service (wait 10s)
sleep 10 && pnpm --filter tariff start

# Terminal 4: Notification Service (wait 5s)
sleep 5 && pnpm --filter notification start

# Terminal 5: API Gateway (wait 5s)
sleep 5 && pnpm --filter api-gateway start

# Terminal 6: Ingestion Service (wait 10s)
sleep 10 && pnpm --filter ingestion start

# Terminal 7: Simulator - Optional (wait 5s)
sleep 5 && pnpm --filter simulator start
```

---

## Verification Checklist

After starting all services, verify:

### 1. Infrastructure Health
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
All containers should show "healthy"

### 2. Kafka Topics
```bash
docker exec segs-kafka kafka-topics --bootstrap-server localhost:9092 --list
```
Should see: raw_readings, aggregates_1m_regional, aggregates_15m, alerts, alerts_processed, tariff_updates

### 3. Service Health Endpoints
```bash
curl http://localhost:3001/health  # Ingestion
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3003/health  # Notification
curl http://localhost:3004/health  # Alert
curl http://localhost:3005/health  # Tariff
```

### 4. Database Connectivity
```bash
# PostgreSQL
docker exec segs-postgres psql -U segs_user -d segs_db -c "\dt"

# TimescaleDB
docker exec segs-timescaledb psql -U segs_user -d segs_db -c "\dt"
```

---

## Testing with Postman

### 1. Import API Collection
Use the `API_RESPONSES.md` file as reference for all endpoints.

### 2. Authentication Flow
```
1. POST /auth/register - Create account
2. POST /auth/verify-otp - Verify email with OTP
3. POST /auth/set-password - Set password
4. POST /auth/login - Get access token
5. Use Bearer token in all subsequent requests
```

### 3. Key Endpoints to Test

**User Profile:**
- GET /user/profile
- PUT /user/profile

**Telemetry Data:**
- GET /telemetry/my-meter (latest reading)
- GET /telemetry/my-meter/history (time series)
- GET /telemetry/my-meter/stats (statistics)

**Tariff Pricing:**
- GET /tariff/current
- GET /tariff/history
- GET /tariff/estimate (cost estimation)

**Alerts:**
- GET /alerts (user alerts)
- GET /alerts/:alertId (alert details)

**Operator Endpoints (requires operator role):**
- GET /telemetry/meters/:meterId
- GET /telemetry/region/:region/stats
- GET /alerts/operator/all

---

## Monitoring

### Kafka UI
http://localhost:8080
- View topics, messages, consumer groups
- Monitor message flow

### Prometheus
http://localhost:9090
- Metrics collection
- Query performance data

### Grafana
http://localhost:3006
- Username: admin
- Password: admin
- Visualize metrics dashboards

---

## Troubleshooting

### Service won't start
1. Check logs: `docker logs segs-<service-name>`
2. Verify dependencies are healthy
3. Check port availability: `lsof -i :<port>`

### Kafka connection issues
```bash
# Restart Kafka
docker restart segs-kafka segs-zookeeper

# Recreate topics
bash scripts/create-topics.sh
```

### Database connection issues
```bash
# Check PostgreSQL
docker exec segs-postgres pg_isready -U segs_user

# Check TimescaleDB
docker exec segs-timescaledb pg_isready -U segs_user

# Restart databases
docker restart segs-postgres segs-timescaledb
```

### Reset Everything
```bash
# Stop all services and clear data
docker-compose down -v

# Restart infrastructure
docker-compose up -d zookeeper kafka redis postgres timescaledb

# Wait 30 seconds
sleep 30

# Recreate Kafka topics
bash scripts/create-topics.sh

# Start microservices in order (see above)
```

---

## Service Dependencies Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                      │
│  Zookeeper → Kafka → Topics (raw_readings, aggregates, etc) │
│  PostgreSQL, TimescaleDB, Redis                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  DATA INGESTION LAYER                        │
│  Simulator → Ingestion Service → Kafka (raw_readings)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  STREAM PROCESSING LAYER                     │
│  Stream Processor → Aggregates (1m, 15m regional)           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  Alert Service → Monitors & generates alerts                │
│  Tariff Service → Dynamic pricing based on demand           │
│  Notification Service → Sends notifications                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│  API Gateway → REST APIs for all services                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

1. **Simulator** generates meter readings
2. **Ingestion** receives & validates → publishes to `raw_readings`
3. **Stream Processor** consumes `raw_readings` → aggregates → publishes to `aggregates_*`
4. **Alert Service** monitors `raw_readings` + `aggregates` → detects anomalies → `alerts`
5. **Tariff Service** monitors `aggregates` → calculates pricing → `tariff_updates`
6. **Notification Service** monitors `alerts_processed` → sends notifications
7. **API Gateway** serves data to clients via REST APIs

---

## Production Notes

- Use environment variables for configuration
- Enable SSL/TLS for all connections
- Set up proper monitoring and alerting
- Configure backup strategies for databases
- Implement proper logging and log rotation
- Use Kubernetes for orchestration in production
- Set up CI/CD pipelines for deployment

---

## Support

- **API Documentation:** `API_RESPONSES.md`
- **Data Flow:** `DATA_FLOW_DOCUMENTATION.md`
- **Implementation Plan:** `IMPLEMENTATION_PLAN.md`
- **Deployment:** `DEPLOYMENT.md`
