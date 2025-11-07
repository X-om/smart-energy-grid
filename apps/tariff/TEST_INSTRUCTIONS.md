# 🧪 Tariff Service Testing Instructions

## Prerequisites

✅ Infrastructure running:
```bash
docker-compose ps
# Should show: kafka, zookeeper, postgres, redis, timescaledb, kafka-ui
```

✅ Service built:
```bash
cd /tmp/smart-energy-grid
pnpm --filter tariff build
```

---

## 🚀 Quick Start (Recommended)

### Option A: Run start script
```bash
cd /tmp/smart-energy-grid/apps/tariff
./start-and-test.sh
```

This will:
1. Start the Tariff Service in background
2. Wait for it to be ready
3. Display test commands for you to run

### Option B: Manual start
```bash
cd /tmp/smart-energy-grid/apps/tariff
node dist/index.js
```

You should see:
```
💰  Smart Energy Grid - Tariff Service v1.0.0
🚀 Tariff Service running
```

---

## ✅ Testing Checklist

### 1. Health Check
```bash
curl http://localhost:3003/health | jq
```

**Expected:**
```json
{
  "status": "ok",
  "service": "tariff",
  "timestamp": "2025-11-07T...",
  "connections": {
    "kafka": true,
    "postgres": true,
    "redis": true
  }
}
```

---

### 2. Get All Current Tariffs
```bash
curl http://localhost:3003/operator/tariffs/all | jq
```

**Expected:**
```json
{
  "status": "success",
  "data": {
    "count": 4,
    "tariffs": [
      {"region": "Bangalore-East", "pricePerKwh": 4.0},
      {"region": "Delhi-South", "pricePerKwh": 4.0},
      {"region": "Mumbai-North", "pricePerKwh": 4.0},
      {"region": "Pune-West", "pricePerKwh": 4.0}
    ]
  }
}
```

---

### 3. Manual Override Test (Night Discount)
```bash
curl -X POST http://localhost:3003/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Pune-West",
    "newPrice": 4.75,
    "reason": "Night discount",
    "operatorId": "OP123"
  }' | jq
```

**Expected:**
```json
{
  "status": "success",
  "message": "Tariff override applied successfully",
  "data": {
    "tariffId": "uuid-here",
    "region": "Pune-West",
    "newPrice": 4.75,
    "oldPrice": 4.0
  }
}
```

---

### 4. Verify Override Applied
```bash
curl http://localhost:3003/operator/tariff/Pune-West | jq
```

**Expected:**
```json
{
  "status": "success",
  "data": {
    "region": "Pune-West",
    "pricePerKwh": 4.75
  }
}
```

---

### 5. Check Tariff History
```bash
curl "http://localhost:3003/operator/tariff/Pune-West/history?limit=5" | jq
```

**Expected:**
```json
{
  "status": "success",
  "data": {
    "region": "Pune-West",
    "history": [
      {
        "tariffId": "...",
        "region": "Pune-West",
        "pricePerKwh": 4.75,
        "effectiveFrom": "2025-11-07T...",
        "reason": "Night discount",
        "triggeredBy": "OP123",
        "createdAt": "2025-11-07T..."
      },
      {
        "tariffId": "...",
        "region": "Pune-West",
        "pricePerKwh": 4.0,
        "effectiveFrom": "2025-11-07T...",
        "reason": "AUTO: Very low load...",
        "triggeredBy": "AUTO",
        "createdAt": "2025-11-07T..."
      }
    ]
  }
}
```

---

### 6. Check Kafka Topic (tariff_updates)

**Option A: Kafka UI (Easiest)**
1. Open http://localhost:8080
2. Click **Topics** in left sidebar
3. Click **tariff_updates**
4. Click **Messages** tab
5. You should see:

```json
{
  "region": "Pune-West",
  "pricePerKwh": 4.75,
  "oldPrice": 4.0,
  "reason": "Night discount",
  "triggeredBy": "OP123",
  "timestamp": "2025-11-07T13:35:00.000Z"
}
```

**Option B: Kafka CLI**
```bash
docker exec segs-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic tariff_updates \
  --from-beginning \
  --max-messages 10
```

---

### 7. Verify PostgreSQL
```bash
PGPASSWORD=segs_password psql -h localhost -p 5432 -U segs_user -d segs_db -c "
  SELECT 
    region, 
    price_per_kwh, 
    TO_CHAR(effective_from, 'YYYY-MM-DD HH24:MI:SS') as effective_from,
    reason,
    triggered_by
  FROM tariffs 
  WHERE region = 'Pune-West'
  ORDER BY effective_from DESC 
  LIMIT 5;
"
```

**Expected:**
```
   region   | price_per_kwh |   effective_from    |     reason      | triggered_by 
------------+---------------+---------------------+-----------------+--------------
 Pune-West  |          4.75 | 2025-11-07 13:35:00 | Night discount  | OP123
 Pune-West  |           4.0 | 2025-11-07 13:20:09 | AUTO: Very low load... | AUTO
```

---

### 8. Verify Redis Cache
```bash
# Get Pune-West tariff from Redis
redis-cli -h localhost -p 6379 GET "tariff:Pune-West"

# List all tariff keys
redis-cli -h localhost -p 6379 KEYS "tariff:*"
```

**Expected:**
```json
{"region":"Pune-West","pricePerKwh":4.75}
```

---

### 9. Check Prometheus Metrics
```bash
curl -s http://localhost:3003/metrics | grep -E "^tariff_" | head -20
```

**Expected:**
```
tariff_current_price{region="Pune-West",service="tariff"} 4.75
tariff_current_price{region="Mumbai-North",service="tariff"} 4.0
tariff_updates_total{region="Pune-West",triggered_by="OP123",service="tariff"} 1
tariff_overrides_total{region="Pune-West",operator="OP123",service="tariff"} 1
tariff_kafka_consumer_connected{service="tariff"} 1
tariff_kafka_producer_connected{service="tariff"} 1
tariff_postgres_connected{service="tariff"} 1
tariff_redis_connected{service="tariff"} 1
```

---

### 10. Test More Regions
```bash
# Mumbai-North → ₹6.25 (Peak hour)
curl -X POST http://localhost:3003/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Mumbai-North",
    "newPrice": 6.25,
    "reason": "Peak hour",
    "operatorId": "OP456"
  }' | jq

# Verify
curl http://localhost:3003/operator/tariff/Mumbai-North | jq
```

---

### 11. Test Error Handling

**Invalid: Price too low**
```bash
curl -X POST http://localhost:3003/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Pune-West",
    "newPrice": 0.10,
    "reason": "Test"
  }' | jq
```

**Expected:**
```json
{
  "status": "error",
  "message": "Price must be between ₹0.50 and ₹20.00"
}
```

**Invalid: Price too high**
```bash
curl -X POST http://localhost:3003/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Pune-West",
    "newPrice": 25.00,
    "reason": "Test"
  }' | jq
```

**Invalid: Missing region**
```bash
curl -X POST http://localhost:3003/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "newPrice": 5.00,
    "reason": "Test"
  }' | jq
```

**Expected:**
```json
{
  "status": "error",
  "message": "Region is required"
}
```

---

## 🔄 Test Automatic Tariff Calculation

To see automatic tariff updates based on load:

### Terminal 1: Tariff Service (already running)
```bash
cd /tmp/smart-energy-grid/apps/tariff
node dist/index.js
```

### Terminal 2: Stream Processor
```bash
cd /tmp/smart-energy-grid/apps/stream-processor
pnpm dev
```

### Terminal 3: Simulator
```bash
cd /tmp/smart-energy-grid/apps/simulator
pnpm dev
```

### Watch the Flow:
1. **Simulator** generates meter readings → `raw_readings` topic
2. **Stream Processor** aggregates → `aggregates_1m` topic
3. **Tariff Service** calculates pricing → saves to DB/Redis → `tariff_updates` topic

**In Tariff Service logs, you'll see:**
```
Tariff updated: region=Pune-West, loadPercent=85.5%, newPrice=₹5.50, change=+10%
```

**Expected pricing based on load:**
- Load 0-25%: ₹4.00 (-20%)
- Load 25-50%: ₹4.50 (-10%)
- Load 50-75%: ₹5.00 (base)
- Load 75-90%: ₹5.50 (+10%)
- Load >90%: ₹6.25 (+25%)

---

## 🧪 Run Comprehensive Test Script

For automated testing of all endpoints:

```bash
cd /tmp/smart-energy-grid/apps/tariff
./test-tariff-service.sh
```

This script tests:
- ✅ Health check
- ✅ Get all tariffs
- ✅ Get specific tariff
- ✅ Manual override
- ✅ Verify override applied
- ✅ Tariff history
- ✅ Prometheus metrics
- ✅ Database verification
- ✅ Redis verification
- ✅ Multiple region overrides
- ✅ Invalid input handling

---

## 🛑 Stopping the Service

If running in foreground:
```bash
Ctrl+C
```

If running in background:
```bash
# Find the process
ps aux | grep "node dist/index.js" | grep tariff

# Kill it
kill <PID>

# Or kill all node processes (careful!)
pkill -f "node.*tariff"
```

---

## 📊 Monitoring During Tests

### Watch Service Logs
```bash
cd /tmp/smart-energy-grid/apps/tariff
tail -f tariff.log
```

### Watch Kafka Messages Live
```bash
docker exec segs-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic tariff_updates
```

### Monitor Metrics
```bash
watch -n 2 'curl -s http://localhost:3003/metrics | grep -E "tariff_(updates|overrides|current_price)"'
```

---

## ✅ Success Criteria

After testing, you should have verified:

- [ ] Service starts without errors
- [ ] All connections (Kafka, PostgreSQL, Redis) are healthy
- [ ] Manual override successfully updates tariff
- [ ] New price reflected in API responses
- [ ] Tariff history shows all changes
- [ ] Kafka topic contains tariff update messages
- [ ] PostgreSQL table has new records
- [ ] Redis cache updated with new prices
- [ ] Prometheus metrics show accurate values
- [ ] Invalid inputs return proper error messages
- [ ] Automatic updates work when aggregates arrive (if Stream Processor running)

---

## 🐛 Troubleshooting

**Service won't start:**
```bash
# Check if port 3003 is in use
lsof -i :3003

# Check infrastructure
docker-compose ps

# Rebuild
pnpm --filter tariff build
```

**No automatic updates:**
```bash
# Ensure Stream Processor is running
ps aux | grep stream-processor

# Check aggregates_1m topic has messages
docker exec segs-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic aggregates_1m \
  --max-messages 5
```

**Database connection error:**
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Test connection
PGPASSWORD=segs_password psql -h localhost -p 5432 -U segs_user -d segs_db -c "SELECT 1"
```

---

## 📚 Additional Resources

- **Kafka UI**: http://localhost:8080
- **Service API**: http://localhost:3003
- **Metrics**: http://localhost:3003/metrics
- **Health**: http://localhost:3003/health

---

**Happy Testing!** 🎉
