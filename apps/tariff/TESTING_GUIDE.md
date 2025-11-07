# Tariff Service - Testing Guide

## Quick Start

### 1. Start the Tariff Service

```bash
cd /tmp/smart-energy-grid/apps/tariff
pnpm dev
```

The service will:
- ✅ Connect to PostgreSQL (localhost:5432)
- ✅ Connect to Redis (localhost:6379)
- ✅ Connect to Kafka (localhost:29092)
- ✅ Run database migrations
- ✅ Preload existing tariffs from DB to Redis
- ✅ Subscribe to `aggregates_1m` topic
- ✅ Start API server on port 3003

You should see:
```
🚀 Tariff Service running
```

### 2. Run the Test Script (In Another Terminal)

```bash
cd /tmp/smart-energy-grid/apps/tariff
./test-tariff-service.sh
```

This will test:
- ✅ Health check
- ✅ Get all current tariffs
- ✅ Manual override (Pune-West → ₹4.75)
- ✅ Tariff history
- ✅ Prometheus metrics
- ✅ Database verification
- ✅ Redis verification
- ✅ Invalid input handling

### 3. Check Kafka Messages

**Option A: Kafka UI (Recommended)**
1. Open http://localhost:8080
2. Navigate to **Topics** → **tariff_updates**
3. Click **Messages**
4. You should see messages like:

```json
{
  "region": "Pune-West",
  "pricePerKwh": 4.75,
  "oldPrice": 5.0,
  "reason": "Night discount",
  "triggeredBy": "OP123",
  "timestamp": "2025-11-07T13:30:00.000Z"
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

### 4. Manual API Tests

**Get Health:**
```bash
curl http://localhost:3003/health | jq
```

**Get All Tariffs:**
```bash
curl http://localhost:3003/operator/tariffs/all | jq
```

**Get Specific Tariff:**
```bash
curl http://localhost:3003/operator/tariff/Pune-West | jq
```

**Manual Override:**
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

**Get History:**
```bash
curl "http://localhost:3003/operator/tariff/Pune-West/history?limit=5" | jq
```

**Get Metrics:**
```bash
curl http://localhost:3003/metrics | grep tariff_
```

### 5. Verify Database Changes

**PostgreSQL:**
```bash
PGPASSWORD=segs_password psql -h localhost -p 5432 -U segs_user -d segs_db -c "
  SELECT 
    region, 
    price_per_kwh, 
    effective_from,
    reason,
    triggered_by
  FROM tariffs 
  WHERE region = 'Pune-West'
  ORDER BY effective_from DESC 
  LIMIT 5;
"
```

**Redis:**
```bash
redis-cli -h localhost -p 6379 GET "tariff:Pune-West"
redis-cli -h localhost -p 6379 KEYS "tariff:*"
```

### 6. Test Automatic Tariff Calculation

To see automatic tariff updates based on load:

**Start Simulator (Terminal 2):**
```bash
cd /tmp/smart-energy-grid/apps/simulator
pnpm dev
```

**Start Stream Processor (Terminal 3):**
```bash
cd /tmp/smart-energy-grid/apps/stream-processor
pnpm dev
```

The flow:
1. Simulator → generates meter readings → `raw_readings` topic
2. Stream Processor → aggregates readings → `aggregates_1m` topic  
3. **Tariff Service** → calculates pricing → saves to DB/Redis → `tariff_updates` topic

Watch the Tariff Service logs for:
```
Tariff updated: region=Pune-West, loadPercent=85.5%, newPrice=₹5.50, change=+10%
```

### 7. Expected Results

**Low Load (0-25%):**
- Tariff: ₹4.00 (-20% from base ₹5.00)
- Reason: "Very low load (X% < 25%)"

**Normal Load (50-75%):**
- Tariff: ₹5.00 (base price)
- Reason: "Normal load (50% ≤ X% < 75%)"

**High Load (75-90%):**
- Tariff: ₹5.50 (+10% from base)
- Reason: "High load (75% ≤ X% < 90%)"

**Critical Load (>90%):**
- Tariff: ₹6.25 (+25% from base)
- Reason: "Critical load (X% ≥ 90%)"

### 8. Monitoring

**Service Logs:**
```bash
# Watch logs in real-time
cd /tmp/smart-energy-grid/apps/tariff
pnpm dev
```

**Prometheus Metrics:**
```bash
curl http://localhost:3003/metrics | grep -E "tariff_|kafka_|postgres_|redis_"
```

Key metrics:
- `tariff_updates_total{region}` - Total tariff updates per region
- `tariff_overrides_total{region,operator}` - Manual overrides
- `tariff_current_price{region}` - Current price per region
- `tariff_kafka_messages_consumed_total` - Messages processed
- `tariff_kafka_messages_published_total` - Updates published
- `tariff_postgres_connected` - DB connection status
- `tariff_redis_connected` - Cache connection status

### 9. Troubleshooting

**Service won't start:**
- Check PostgreSQL: `docker-compose ps postgres`
- Check Redis: `docker-compose ps redis`
- Check Kafka: `docker-compose ps kafka`
- Rebuild: `pnpm --filter tariff build`

**No automatic updates:**
- Ensure Stream Processor is running
- Check if `aggregates_1m` topic has messages
- Verify Kafka consumer is connected (check logs)

**API errors:**
- Verify service is running: `curl http://localhost:3003/health`
- Check logs for errors
- Ensure payload is valid JSON

**Database errors:**
- Check migrations ran: Look for "Database migrations completed successfully" in logs
- Verify table exists: `psql -h localhost -U segs_user -d segs_db -c "\dt tariffs"`

### 10. Clean Up

**Stop service:**
- Press `Ctrl+C` in the terminal running `pnpm dev`

**Clear test data:**
```bash
PGPASSWORD=segs_password psql -h localhost -p 5432 -U segs_user -d segs_db -c "TRUNCATE tariffs;"
redis-cli -h localhost -p 6379 FLUSHDB
```

**Reset Kafka topic:**
```bash
docker exec segs-kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic tariff_updates
docker exec segs-kafka kafka-topics --bootstrap-server localhost:9092 --create --topic tariff_updates --partitions 1 --replication-factor 1
```

---

## Test Checklist

- [ ] Service starts without errors
- [ ] Health check returns `{"status":"ok"}`
- [ ] All connections show as `true` (kafka, postgres, redis)
- [ ] Manual override successfully updates tariff
- [ ] New price reflected in API response
- [ ] History shows both old and new tariffs
- [ ] Kafka topic contains update message
- [ ] PostgreSQL table has new record
- [ ] Redis cache updated with new price
- [ ] Prometheus metrics show non-zero values
- [ ] Invalid inputs return proper error messages
- [ ] Automatic updates work when aggregates arrive

---

**Ready to test!** 🚀

Run `./test-tariff-service.sh` after starting the service.
