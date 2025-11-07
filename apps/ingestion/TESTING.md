# Ingestion Service - Testing Guide

## 📋 Prerequisites

Before testing the ingestion service, ensure you have the following running:

1. **Kafka** - Running on `localhost:29092`
2. **Redis** - Running on `localhost:6379`

You can start both using Docker Compose from the project root:

```bash
cd /tmp/smart-energy-grid
docker-compose up -d zookeeper kafka redis
```

Wait ~30 seconds for Kafka to be ready.

## 🚀 Quick Start

### 1. Start the Ingestion Service

```bash
cd apps/ingestion
pnpm dev
```

Expected output:
```
╔═══════════════════════════════════════════════════════════════╗
║     📥  Smart Energy Grid - Ingestion Service v1.0.0         ║
╚═══════════════════════════════════════════════════════════════╝

[INFO] Initializing Ingestion Service...
[INFO] Connecting to Kafka...
[INFO] Kafka producer ready
[INFO] Connecting to Redis...
[INFO] Connected to Redis for deduplication
[INFO] All services initialized successfully
[INFO] 🚀 Ingestion Service started
```

### 2. Check Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "ingestion",
  "timestamp": "2025-11-07T10:00:00.000Z",
  "uptime": 5.2,
  "connections": {
    "redis": true,
    "kafka": true
  }
}
```

## 🧪 Testing Endpoints

### Test 1: Single Reading (Valid)

```bash
curl -X POST http://localhost:3001/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "readingId": "550e8400-e29b-41d4-a716-446655440000",
    "meterId": "MTR-00000001",
    "userId": "USR-00000001",
    "timestamp": "2025-11-07T10:00:00.000Z",
    "powerKw": 2.5,
    "energyKwh": 0.0034,
    "voltage": 230.5,
    "region": "Pune-West",
    "seq": 1,
    "status": "OK"
  }'
```

Expected response (200):
```json
{
  "status": "success",
  "readingId": "550e8400-e29b-41d4-a716-446655440000",
  "topic": "raw_readings",
  "partition": 2,
  "offset": "12345"
}
```

### Test 2: Duplicate Reading

Submit the same reading again:

```bash
curl -X POST http://localhost:3001/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "readingId": "550e8400-e29b-41d4-a716-446655440000",
    "meterId": "MTR-00000001",
    "userId": "USR-00000001",
    "timestamp": "2025-11-07T10:00:00.000Z",
    "powerKw": 2.5,
    "energyKwh": 0.0034,
    "voltage": 230.5,
    "region": "Pune-West",
    "seq": 1,
    "status": "OK"
  }'
```

Expected response (200):
```json
{
  "status": "success",
  "message": "Reading already processed",
  "readingId": "550e8400-e29b-41d4-a716-446655440000",
  "duplicate": true
}
```

### Test 3: Invalid Reading (Missing Required Field)

```bash
curl -X POST http://localhost:3001/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "readingId": "550e8400-e29b-41d4-a716-446655440001",
    "meterId": "MTR-00000002",
    "timestamp": "2025-11-07T10:00:00.000Z",
    "powerKw": 2.5
  }'
```

Expected response (400):
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    "region: Required"
  ]
}
```

### Test 4: Batch Submission

```bash
curl -X POST http://localhost:3001/telemetry/batch \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {
        "readingId": "550e8400-e29b-41d4-a716-446655440010",
        "meterId": "MTR-00000010",
        "userId": "USR-00000005",
        "timestamp": "2025-11-07T10:00:00.000Z",
        "powerKw": 3.2,
        "energyKwh": 0.0044,
        "voltage": 232.1,
        "region": "Mumbai-North",
        "seq": 1,
        "status": "OK"
      },
      {
        "readingId": "550e8400-e29b-41d4-a716-446655440011",
        "meterId": "MTR-00000011",
        "userId": "USR-00000006",
        "timestamp": "2025-11-07T10:00:00.000Z",
        "powerKw": 2.8,
        "energyKwh": 0.0038,
        "voltage": 228.5,
        "region": "Delhi-South",
        "seq": 1,
        "status": "OK"
      }
    ]
  }'
```

Expected response (200):
```json
{
  "status": "success",
  "accepted": 2,
  "duplicates": 0,
  "failed": 0,
  "topic": "raw_readings",
  "partitions": [0, 1]
}
```

## 🔗 Integration Test with Simulator

The best way to test the ingestion service is with the simulator:

### Step 1: Configure Simulator

```bash
cd ../simulator

# Edit .env or use CLI args
# TARGET=http
# INGESTION_URL=http://localhost:3001/telemetry/batch
```

### Step 2: Run Simulator

```bash
# Send 100 meters, 2 cycles
pnpm dev -- --target http --meters 100 --iterations 2
```

Expected output:
```
[INFO] 🚀 Starting telemetry simulator
    meters: 100
    interval: "5s"
    mode: "normal"
    target: "http"

[INFO] 📊 Cycle complete
    cycle: 1
    generated: 101
    sent: 101
    errors: 0
    latency: "125ms"
    successRate: "100.0%"
```

### Step 3: Verify in Kafka

```bash
# Check messages in Kafka topic
docker exec segs-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic raw_readings \
  --from-beginning \
  --max-messages 5
```

### Step 4: Check Metrics

```bash
curl http://localhost:3001/metrics | grep ingestion
```

Look for:
- `ingestion_success_total` - Should match readings sent
- `kafka_messages_published_total` - Should match accepted readings
- `deduplicated_messages_total` - Should show duplicates filtered

## 📊 Monitoring

### View Logs

The ingestion service logs all operations:

```bash
# View in real-time
pnpm dev

# Or if running in background
tail -f logs/ingestion.log
```

### Kafka UI

Visit **http://localhost:8080** to view:
- Topics (`raw_readings`)
- Message counts
- Partitions
- Consumer lag

### Redis Keys

Check deduplication keys:

```bash
redis-cli

# List all reading keys
KEYS reading:*

# Check a specific reading
GET reading:550e8400-e29b-41d4-a716-446655440000

# Get TTL
TTL reading:550e8400-e29b-41d4-a716-446655440000
```

## 🔧 Troubleshooting

### Issue: "Connection error" to Kafka

**Solution:**
```bash
# Check if Kafka is running
docker ps | grep kafka

# Check Kafka logs
docker logs segs-kafka

# Ensure you're using the correct port
# Host connections: localhost:29092
# Docker connections: kafka:9092
```

### Issue: "Redis client error"

**Solution:**
```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
redis-cli ping  # Should return PONG

# Check Redis logs
docker logs segs-redis
```

### Issue: "Validation failed"

**Solution:**
- Ensure request body matches `TelemetryReading` schema
- Required fields: `readingId`, `meterId`, `timestamp`, `powerKw`, `region`
- `readingId` must be valid UUID
- `powerKw` must be non-negative number
- `timestamp` must be ISO 8601 format

### Issue: High latency

**Possible causes:**
1. Redis connection slow - Check network/connection pool
2. Kafka producer backpressure - Check broker health
3. Large batch size - Consider batching at 500-1000 max

**Solutions:**
```bash
# Check Redis latency
redis-cli --latency

# Check Kafka broker metrics
docker exec segs-kafka kafka-broker-api-versions \
  --bootstrap-server localhost:9092

# Monitor request duration
curl http://localhost:3001/metrics | grep request_duration
```

## 📈 Performance Testing

### Load Test with Apache Bench

```bash
# Create test payload
cat > test-reading.json << EOF
{
  "readingId": "550e8400-e29b-41d4-a716-446655440099",
  "meterId": "MTR-00000099",
  "timestamp": "2025-11-07T10:00:00.000Z",
  "powerKw": 2.5,
  "region": "Pune-West",
  "status": "OK"
}
EOF

# Run load test (100 requests, 10 concurrent)
ab -n 100 -c 10 -T application/json -p test-reading.json \
  http://localhost:3001/telemetry
```

### Load Test with Simulator

```bash
# High-throughput test: 5000 meters, continuous
cd ../simulator
pnpm dev -- --target http --meters 5000 --iterations 0
```

Monitor metrics during load:
```bash
watch -n 1 'curl -s http://localhost:3001/metrics | grep -E "(ingestion_success|kafka_produce_latency|request_duration)"'
```

## ✅ Validation Checklist

- [ ] Service starts without errors
- [ ] `/health` endpoint returns 200 with both connections true
- [ ] Single telemetry POST succeeds
- [ ] Duplicate reading is detected and ignored
- [ ] Invalid reading returns 400 error
- [ ] Batch endpoint accepts array of readings
- [ ] Messages appear in Kafka topic `raw_readings`
- [ ] Redis keys created with 60s TTL
- [ ] `/metrics` endpoint returns Prometheus format
- [ ] Graceful shutdown works (Ctrl+C)
- [ ] Integration with simulator successful
- [ ] Performance meets >500 msg/sec target

## 🎯 Success Criteria

Your ingestion service is working correctly if:

1. ✅ Accepts valid telemetry readings via HTTP
2. ✅ Validates against `TelemetryReading` schema
3. ✅ Detects and filters duplicates via Redis
4. ✅ Publishes to Kafka `raw_readings` topic
5. ✅ Handles batches of up to 1000 readings
6. ✅ Returns appropriate HTTP status codes
7. ✅ Exposes health and metrics endpoints
8. ✅ Logs structured JSON/pretty output
9. ✅ Gracefully shuts down on signals
10. ✅ Integrates with simulator successfully
