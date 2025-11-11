# Phase 4 Telemetry Testing Plan

**Date:** November 11, 2025  
**Goal:** Test Phase 4 telemetry endpoints with real data flow across all services  
**Status:** ✅ All data inconsistencies resolved - Ready for full testing

---

## 🎯 Fixes Applied (November 11, 2025)

### ✅ Fix 1: Region Validation Mismatch
- **Updated:** API Gateway validators to accept city-region format (`Delhi-South`, `Mumbai-North`, etc.)
- **Files:** 4 validation files in `apps/api-gateway/src/`
- **Impact:** Regional queries now work correctly

### ✅ Fix 2: Missing Aggregate Calculations  
- **Updated:** Stream processor to calculate `min_power_kw` and `voltage_avg`
- **Files:** `aggregator.ts` and `timescale.ts` in stream processor
- **Impact:** Stats endpoints will return accurate min/voltage data
- **⚠️ Requires:** Stream processor restart to take effect

### ✅ Fix 3: 15m Aggregates Verification
- **Result:** Working correctly (timer-based, runs every 15 minutes)
- **No changes needed**

---

## 📋 Overview

To test telemetry endpoints, we need data in TimescaleDB (`aggregates_1m` and `aggregates_15m` tables). This requires the complete data pipeline:

```
Simulator → Ingestion → Kafka → Stream Processor → TimescaleDB → API Gateway
```

---

## 🔄 Data Flow Chain

### 1. Simulator Service (Port 3006)
- **Purpose:** Generate mock energy consumption data
- **Output:** HTTP POST to Ingestion service
- **Data:** Meter readings with power_kw, energy_kwh, timestamp

### 2. Ingestion Service (Port 3001)
- **Purpose:** Receive readings and publish to Kafka
- **Input:** HTTP POST from Simulator
- **Output:** Publishes to `raw_readings` Kafka topic
- **Validation:** Schema validation, meter existence check

### 3. Kafka (Port 9092)
- **Purpose:** Message broker for streaming data
- **Topic:** `raw_readings`
- **Partitions:** Multiple for parallel processing

### 4. Stream Processor Service
- **Purpose:** Consume from Kafka, aggregate, write to TimescaleDB
- **Input:** Consumes `raw_readings` topic
- **Output:** Writes to `aggregates_1m` and `aggregates_15m` tables
- **Processing:** Time-windowed aggregations (1min, 15min)

### 5. TimescaleDB (Port 5433)
- **Purpose:** Store time-series aggregates
- **Tables:** `aggregates_1m`, `aggregates_15m`, `aggregates_1m_by_region`
- **Schema:** meter_id, region, window_start, avg_power_kw, max_power_kw, energy_kwh_sum, count

### 6. API Gateway (Port 3000)
- **Purpose:** Query TimescaleDB and serve telemetry endpoints
- **Endpoints:** 11 telemetry routes (6 user, 5 operator)

---

## 🚀 Startup Sequence

### Prerequisites
```bash
# Check Docker containers are running
docker ps | grep -E "segs-postgres|segs-timescale|segs-kafka|segs-zookeeper|segs-redis"

# Expected containers:
# - segs-postgres (PostgreSQL - port 5432)
# - segs-timescale (TimescaleDB - port 5433)
# - segs-kafka (Kafka - port 9092)
# - segs-zookeeper (Zookeeper - port 2181)
# - segs-redis (Redis - port 6379) - optional for caching
```

### Step 1: Start Infrastructure (if not running)
```bash
cd /tmp/smart-energy-grid
docker-compose up -d
```

### Step 2: Verify TimescaleDB Tables
```bash
# Check if aggregates tables exist
docker exec segs-timescale psql -U segs_user -d segs_timescale -c "\dt"

# Verify schema
docker exec segs-timescale psql -U segs_user -d segs_timescale -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'aggregates_1m'
"
```

### Step 3: Start Stream Processor (Consumer)
```bash
cd /tmp/smart-energy-grid/apps/stream-processor
pnpm dev

# Expected output:
# - Connected to Kafka
# - Connected to TimescaleDB
# - Subscribed to raw_readings topic
# - Consumer group active
```

### Step 4: Start Ingestion Service (Producer)
```bash
cd /tmp/smart-energy-grid/apps/ingestion
pnpm dev

# Expected output:
# - Server running on port 3001
# - Connected to PostgreSQL (for meter validation)
# - Connected to Kafka producer
```

### Step 5: Start API Gateway
```bash
cd /tmp/smart-energy-grid/apps/api-gateway
pnpm dev

# Expected output:
# - Server running on port 3000
# - Connected to PostgreSQL
# - Connected to TimescaleDB
# - Connected to Redis (optional)
```

### Step 6: Start Simulator
```bash
cd /tmp/smart-energy-grid/apps/simulator
pnpm dev

# Expected output:
# - Generating readings for N meters
# - Sending to http://localhost:3001/api/v1/ingest/readings
# - Success rate should be ~100%
```

---

## 🧪 Testing Plan

### Phase A: Data Ingestion Verification (5-10 minutes)

#### A1: Check Simulator is Sending
```bash
# Monitor simulator logs
# Should see: "Sent reading for meter-XXX: 200 OK"
```

#### A2: Check Ingestion is Receiving
```bash
# Monitor ingestion logs
# Should see: "Published reading to Kafka: meter-XXX"
```

#### A3: Check Kafka Topic
```bash
# Check if messages are in topic
docker exec segs-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic raw_readings \
  --from-beginning \
  --max-messages 5
```

#### A4: Check Stream Processor is Processing
```bash
# Monitor stream-processor logs
# Should see: "Processed N readings in window"
# Should see: "Inserted X aggregates into aggregates_1m"
```

#### A5: Verify Data in TimescaleDB
```bash
# Check aggregates_1m table
docker exec segs-timescale psql -U segs_user -d segs_timescale -c "
  SELECT 
    meter_id, 
    window_start, 
    avg_power_kw, 
    max_power_kw, 
    energy_kwh_sum 
  FROM aggregates_1m 
  ORDER BY window_start DESC 
  LIMIT 10
"

# Check aggregates_15m table
docker exec segs-timescale psql -U segs_user -d segs_timescale -c "
  SELECT COUNT(*) as total_records FROM aggregates_15m
"
```

### Phase B: API Endpoint Testing

#### Prerequisites
- Let simulator run for at least 5-10 minutes to accumulate data
- Get JWT token from login endpoint
- Have a user with assigned meter_id

#### B1: User Authentication
```bash
# Login to get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "yourpassword"
  }'

# Save the access_token from response
export TOKEN="your_access_token_here"
```

#### B2: Test User Endpoints

**1. Get Latest Reading**
```bash
curl -X GET http://localhost:3000/api/v1/telemetry/my-meter \
  -H "Authorization: Bearer $TOKEN"

# Expected: Latest 1-minute aggregate for user's meter
```

**2. Get Meter History**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/my-meter/history?resolution=1m&start=2025-11-11T00:00:00Z&end=2025-11-11T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of 1-minute aggregates
```

**3. Get Consumption Stats**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/my-meter/stats?start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"

# Expected: total_consumption_kwh, avg_power_kw, max_power_kw, min_power_kw, data_points
```

**4. Get Daily Breakdown**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/my-meter/daily?start_date=2025-11-01&end_date=2025-11-11" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of daily totals
```

**5. Get Monthly Breakdown**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/my-meter/monthly?start_month=2025-01&end_month=2025-11" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of monthly totals
```

**6. Compare Periods**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/my-meter/compare?period1_start=2025-11-01T00:00:00Z&period1_end=2025-11-07T23:59:59Z&period2_start=2025-11-08T00:00:00Z&period2_end=2025-11-11T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"

# Expected: period1 stats, period2 stats, change_kwh, change_percent
```

#### B3: Test Operator/Admin Endpoints

**Prerequisites:**
- Login as operator or admin user
- Know a specific meter_id from database

**1. Get Specific Meter Reading**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/meters/meter-123" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

**2. Get Meter History**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/meters/meter-123/history?resolution=15m&start=2025-11-11T00:00:00Z&end=2025-11-11T23:59:59Z" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

**3. Get Regional Statistics**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/region/north/stats?start=2025-11-10T00:00:00Z&end=2025-11-11T23:59:59Z" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Expected: total_consumption_kwh, active_meters, avg_consumption_per_meter, peak_load_kw
```

**4. Get Top Consumers**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/region/north/top-consumers?limit=10&start=2025-11-01T00:00:00Z&end=2025-11-11T23:59:59Z" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Expected: Array of top 10 consumers with meter_id, total_kwh, avg_kw, rank
```

**5. Get Real-time Regional Load**
```bash
curl -X GET "http://localhost:3000/api/v1/telemetry/region/north/realtime" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Expected: current_load_kw, active_meters, timestamp (last 5 minutes)
```

---

## 🐛 Expected Issues & Solutions

### Issue 1: No Data in TimescaleDB
**Symptoms:** API returns "No data found" errors
**Checks:**
1. Is simulator running and sending requests?
2. Is ingestion service receiving and publishing to Kafka?
3. Is stream processor consuming from Kafka?
4. Are there errors in stream processor logs?

**Solution:**
```bash
# Check Kafka consumer group lag
docker exec segs-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group stream-processor-group \
  --describe
```

### Issue 2: Data Type Mismatches
**Symptoms:** Stream processor fails to insert into TimescaleDB
**Checks:**
1. Compare schema between services
2. Check meter_id format (STRING vs UUID)
3. Check region values match enum

**Solution:**
- Document mismatches in TESTING_PHASE_4.md
- Create migration plan to fix schema inconsistencies

### Issue 3: Authentication Failures
**Symptoms:** 401 Unauthorized errors
**Checks:**
1. Is JWT token valid and not expired?
2. Does user have assigned meter_id?
3. Does user have correct role for operator endpoints?

**Solution:**
```bash
# Create test users with different roles
# Verify meter assignments in PostgreSQL
docker exec segs-postgres psql -U segs_user -d segs_db -c "
  SELECT user_id, email, role, meter_id, region 
  FROM users 
  WHERE email = 'test@example.com'
"
```

### Issue 4: Missing Meters in Database
**Symptoms:** Ingestion rejects readings, 404 meter not found
**Checks:**
1. Do meters exist in PostgreSQL?
2. Does simulator use valid meter IDs?

**Solution:**
```bash
# Check meters table
docker exec segs-postgres psql -U segs_user -d segs_db -c "
  SELECT meter_id, region, status FROM meters LIMIT 10
"

# Seed meters if needed (check scripts/seed-db.sh)
```

---

## 📊 Data Inconsistency Tracking

### Known Inconsistencies

#### ✅ 1. Region Value Mismatch - **FIXED**
- **Initial Issue:** API Gateway enum expected `'north' | 'south' | 'east' | 'west' | 'central'`
- **Actual Data:** Uses city-region format: `'Delhi-South'`, `'Mumbai-North'`, `'Bangalore-East'`, `'Pune-West'`
- **Resolution:** Updated all API Gateway validators to accept actual region formats
- **Files Updated:**
  - `apps/api-gateway/src/middleware/validation/auth.validation.ts`
  - `apps/api-gateway/src/middleware/validation/user.validation.ts`
  - `apps/api-gateway/src/middleware/validation/telemetry.validation.ts`
  - `apps/api-gateway/src/utils/validators.ts`
- **Status:** ✅ Complete - Region validation now matches data format

#### ✅ 2. Stream Processor 15m Aggregates - **NOT AN ISSUE**
- **Initial Concern:** `aggregates_15m` table was empty after 19 minutes
- **Root Cause:** Flush interval is timer-based (every 15 minutes), first window hadn't completed yet
- **Verification:** After waiting, 500 records appeared (one per meter per 15-minute window)
- **Status:** ✅ Working as designed - no fix needed

#### ✅ 3. Missing Aggregate Calculations - **FIXED**
- **Initial Issue:** Stream processor didn't calculate `min_power_kw`, `voltage_avg`, `current_avg`
- **Impact:** These fields always returned 0 in API responses
- **Resolution:** 
  - Added **min_power_kw** tracking in aggregation windows
  - Added **voltage_avg** calculation from raw voltage readings (when available)
  - Set **current_avg** to 0 (not available in raw telemetry data)
- **Files Updated:**
  - `apps/stream-processor/src/services/aggregator.ts` - Updated AggregateWindow interface, tracking logic
  - `apps/stream-processor/src/db/timescale.ts` - Updated Aggregate1m/15m interfaces, INSERT queries
- **Status:** ✅ Complete - Requires stream processor restart to apply

#### ℹ️ 4. Meter ID Format Variance - **ACCEPTABLE**
- **PostgreSQL (API Gateway):** TEXT/UUID format for user assignments
- **TimescaleDB (Stream Processor):** TEXT format `MTR-00000159`
- **Impact:** No issues - TEXT column type handles both formats
- **Resolution:** No action needed - working as is

#### 4. Timestamp Formats
- **API Gateway:** ISO 8601 strings in queries
- **TimescaleDB:** TIMESTAMPTZ
- **Kafka Messages:** ISO strings
- **Impact:** Currently working correctly with automatic conversion
- **Resolution:** No action needed - PostgreSQL handles conversion properly

---

## ✅ Success Criteria

### Must Pass:
- [ ] All 6 user endpoints return valid data
- [ ] All 5 operator endpoints return valid data
- [ ] Data flows through entire pipeline (Simulator → TimescaleDB)
- [ ] Aggregations are mathematically correct
- [ ] Authorization works (user cannot access operator endpoints)
- [ ] Time ranges are respected in queries
- [ ] No 500 errors or crashes

### Should Pass:
- [ ] Queries complete in <500ms for 24-hour ranges
- [ ] Queries complete in <2s for 30-day ranges
- [ ] Real-time endpoint shows data within last 5 minutes
- [ ] Period comparison shows accurate percentage changes

### Nice to Have:
- [ ] Redis caching improves response times
- [ ] Grafana dashboards show same data as API
- [ ] Multiple regions have balanced data

---

## 🔄 Service Startup Commands (Quick Reference)

```bash
# Terminal 1: Stream Processor
cd /tmp/smart-energy-grid/apps/stream-processor && pnpm dev

# Terminal 2: Ingestion
cd /tmp/smart-energy-grid/apps/ingestion && pnpm dev

# Terminal 3: API Gateway
cd /tmp/smart-energy-grid/apps/api-gateway && pnpm dev

# Terminal 4: Simulator
cd /tmp/smart-energy-grid/apps/simulator && pnpm dev

# Monitor all logs in one terminal (alternative)
cd /tmp/smart-energy-grid
docker-compose logs -f
```

---

## 📝 Notes

- **Test Duration:** Allow 10-15 minutes for data accumulation before testing
- **Data Volume:** Simulator should generate 100+ readings per minute
- **Time Zones:** All times in UTC for consistency
- **Cleanup:** To reset and test again, truncate TimescaleDB tables

### Reset TimescaleDB Data
```bash
docker exec segs-timescale psql -U segs_user -d segs_timescale -c "
  TRUNCATE TABLE aggregates_1m, aggregates_15m CASCADE
"
```

---

**Next Steps After Testing:**
1. Document all data inconsistencies found
2. Create tickets/plan to fix schema mismatches
3. Update IMPLEMENTATION_PLAN.md with Phase 4 completion status
4. Move to Phase 5: Tariff Routes
