# Alert Service Testing Guide

## ✅ Service is Working!

The Alert Service successfully:
- Consumes messages from Kafka `aggregates_1m` topic
- Detects regional overloads (>90% load for 2 consecutive windows)
- Creates alerts in PostgreSQL
- Publishes processed alerts to Kafka
- Exposes REST API for operators

## Testing Steps

### 1. Start the Service
```bash
cd apps/alert
pnpm dev
```

### 2. Test Regional Overload Detection

**Important:** Messages must have **current timestamps** for the time-window logic to work correctly.

Send two consecutive overload messages (load_percentage > 90):

```bash
# First message
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "{\"region\":\"Pune-West\",\"timestamp\":\"$NOW\",\"meter_count\":100,\"total_consumption\":9500,\"avg_consumption\":95,\"max_consumption\":150,\"min_consumption\":50,\"load_percentage\":95.0,\"active_meters\":[\"meter-001\",\"meter-002\"]}" | \
docker exec -i segs-kafka kafka-console-producer --topic aggregates_1m --broker-list localhost:9092

# Wait 1 second, then send second message
sleep 1
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "{\"region\":\"Pune-West\",\"timestamp\":\"$NOW\",\"meter_count\":100,\"total_consumption\":9600,\"avg_consumption\":96,\"max_consumption\":155,\"min_consumption\":52,\"load_percentage\":96.0,\"active_meters\":[\"meter-001\",\"meter-002\"]}" | \
docker exec -i segs-kafka kafka-console-producer --topic aggregates_1m --broker-list localhost:9092
```

### 3. Check Logs

You should see in the service logs:
```
[INFO] Regional overload detected
[INFO] Alert created: <uuid>
[INFO] Published processed alert
[INFO] Alert created successfully
```

### 4. Query Alerts via API

```bash
# List all alerts
curl http://localhost:3004/operator/alerts | jq .

# Get active alerts only
curl http://localhost:3004/operator/alerts/active | jq .

# Get alerts by region
curl http://localhost:3004/operator/alerts/region/Pune-West | jq .

# Get specific alert
curl http://localhost:3004/operator/alerts/<alert-id> | jq .
```

### 5. Acknowledge an Alert

```bash
curl -X POST http://localhost:3004/operator/alerts/<alert-id>/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"acknowledged_by": "operator@example.com", "notes": "Investigating the issue"}' | jq .
```

### 6. Resolve an Alert

```bash
curl -X POST http://localhost:3004/operator/alerts/<alert-id>/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolved_by": "operator@example.com", "resolution_notes": "Load balanced"}' | jq .
```

## Expected Alert Response

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "4282fd60-b420-401a-b541-de8f1964a809",
        "type": "REGIONAL_OVERLOAD",
        "severity": "high",
        "region": "Bangalore-East",
        "meter_id": null,
        "message": "Regional overload detected: 96.7% load for 2 consecutive time windows",
        "status": "active",
        "timestamp": "2025-11-07T16:13:23.093Z",
        "acknowledged": false,
        "acknowledged_by": null,
        "metadata": {
          "timestamp": "2025-11-07T16:13:22Z",
          "meter_count": 120,
          "window_count": 2,
          "load_percentage": 96.7,
          "total_consumption": 11600
        },
        "created_at": "2025-11-07T16:13:23.093Z",
        "updated_at": "2025-11-07T16:13:23.093Z"
      }
    ],
    "total": 1
  }
}
```

## Alert Detection Rules

### 1. Regional Overload Detection
- **Trigger**: `load_percentage > 90` for 2 consecutive 1-minute windows
- **Time Window**: 5 minutes
- **Severity**: `high` or `critical` based on load level
- **Cooldown**: 5 minutes per region

### 2. Meter Outage Detection
- **Trigger**: No reading from meter for > 30 seconds
- **Severity**: `medium`
- **Cooldown**: 1 minute per meter

### 3. Anomaly Forwarding
- **Trigger**: Receives anomaly alert from stream-processor
- **Severity**: Inherited from source
- **Action**: Enriches and stores in database

### 4. High Consumption Detection
- **Trigger**: Configurable threshold
- **Severity**: `high`

### 5. Low Generation Detection
- **Trigger**: Regional generation below threshold
- **Severity**: `critical`

## Troubleshooting

### No Alerts Being Created

1. **Check service logs**: Set `LOG_LEVEL=debug` in `.env` file
2. **Verify Kafka connection**: Check consumer group status
   ```bash
   docker exec segs-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group alert-group
   ```
3. **Check message format**: Ensure all required fields are present
4. **Verify timestamps**: Messages must have recent timestamps (within 5-10 minutes)
5. **Multiple instances**: Ensure only ONE instance is running (check with `ps aux | grep "node.*dist/index"`)

### Consumer Not Receiving Messages

- Use `localhost:29092` when running locally (not `localhost:9092`)
- Check topic exists: `docker exec segs-kafka kafka-topics --list --bootstrap-server localhost:9092`
- Verify messages in topic: `docker exec segs-kafka kafka-console-consumer --topic aggregates_1m --from-beginning --bootstrap-server localhost:9092 --max-messages 5`

### Database Connection Failed

- Ensure PostgreSQL is running: `docker ps | grep postgres`
- Check credentials in `.env` match docker-compose.yml
- Run migrations manually if needed:
  ```bash
  docker exec -i segs-postgres psql -U segs_user -d segs_db < src/db/migrations/001_create_alerts.sql
  ```

## Health Check

```bash
curl http://localhost:3004/health | jq .
```

Expected response shows all connections healthy:
```json
{
  "status": "healthy",
  "connections": {
    "postgres": true,
    "redis": true,
    "kafka_consumer": true,
    "kafka_producer": true
  }
}
```

## Metrics

```bash
curl http://localhost:3004/metrics
```

Key metrics:
- `alerts_total` - Total alerts created
- `alerts_active_total` - Currently active alerts  
- `kafka_connection_status` - Kafka connectivity
- `postgres_connection_status` - PostgreSQL connectivity
- `redis_connection_status` - Redis connectivity
- `http_requests_total` - API request counts

## Quick Test Script

Use the provided test script:
```bash
chmod +x test-alert.sh
./test-alert.sh
```

This script:
1. Checks service health
2. Sends two overload messages
3. Queries created alerts
4. Shows active alerts
5. Displays statistics

---

**Status**: ✅ Fully Functional
**Last Tested**: 2025-11-07
