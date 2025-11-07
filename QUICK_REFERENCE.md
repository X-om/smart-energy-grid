# 🚀 SEGS Quick Reference

## One-Line Startup

```bash
./scripts/start-segs.sh
```

---

## Essential Commands

### System Control

```bash
# Start everything
docker compose up -d

# Stop everything
docker compose down

# Complete reset (removes data)
docker compose down -v

# Rebuild and start
docker compose up -d --build

# View status
docker compose ps
```

### Service Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api-gateway

# Last 50 lines
docker compose logs --tail=50 ingestion
```

### Health Checks

```bash
# Comprehensive health check
./scripts/health-check.sh

# Individual service health
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # Ingestion
curl http://localhost:3003/health  # Tariff
curl http://localhost:3005/health  # Notification
```

---

## Database Quick Access

### PostgreSQL

```bash
# Connect
docker exec -it segs-postgres psql -U segs_user -d segs_db

# Quick queries
docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT COUNT(*) FROM users;"
docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT * FROM alerts ORDER BY created_at DESC LIMIT 5;"
```

### TimescaleDB

```bash
# Connect
docker exec -it segs-timescaledb psql -U segs_user -d segs_db

# Quick queries
docker exec segs-timescaledb psql -U segs_user -d segs_db -c "SELECT COUNT(*) FROM aggregates_1m;"
docker exec segs-timescaledb psql -U segs_user -d segs_db -c "SELECT meter_id, AVG(avg_power_kw) FROM aggregates_1m WHERE window_start > NOW() - INTERVAL '1 hour' GROUP BY meter_id;"
```

### Redis

```bash
# Connect
docker exec -it segs-redis redis-cli

# Quick commands
docker exec segs-redis redis-cli KEYS "tariff:*"
docker exec segs-redis redis-cli GET "tariff:Pune-West"
```

---

## Kafka Operations

### View Topics (UI)

http://localhost:8080

### CLI Commands

```bash
# List topics
docker exec segs-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

# Consume messages
docker exec segs-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic raw_readings \
  --from-beginning \
  --max-messages 10

# Topic details
docker exec segs-kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --describe --topic alerts
```

---

## API Testing

### Login

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.data.token')

echo $TOKEN
```

### User Endpoints

```bash
# Profile
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/me | jq .

# Consumption
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/users/me/consumption?granularity=1m&limit=10" | jq .

# Current tariff
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/me/tariff/current | jq .

# Alerts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/me/alerts | jq .
```

### Operator Endpoints

```bash
# Login as operator
OP_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@example.com","password":"password123"}' \
  | jq -r '.data.token')

# All alerts
curl -H "Authorization: Bearer $OP_TOKEN" http://localhost:3000/api/operator/alerts | jq .

# Grid load
curl -H "Authorization: Bearer $OP_TOKEN" http://localhost:3000/api/operator/grid/load | jq .

# Statistics
curl -H "Authorization: Bearer $OP_TOKEN" http://localhost:3000/api/operator/statistics | jq .
```

---

## Simulator

```bash
# Default (100 meters, 5s interval)
./scripts/run-simulator.sh

# Custom configuration
./scripts/run-simulator.sh --meters 500 --interval 10000 --batch-size 100

# High load test
./scripts/run-simulator.sh --meters 5000 --interval 1000
```

---

## Monitoring

### Quick Links

- **API Docs:** http://localhost:3000/docs
- **Kafka UI:** http://localhost:8080
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3006 (admin/admin)

### Metrics Endpoints

```bash
curl http://localhost:3000/metrics  # API Gateway
curl http://localhost:3001/metrics  # Ingestion
curl http://localhost:3002/metrics  # Stream Processor
curl http://localhost:3004/metrics  # Alert
curl http://localhost:3005/metrics  # Notification
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Restart
docker compose restart <service-name>

# Rebuild
docker compose up -d --build <service-name>
```

### Database Issues

```bash
# Check PostgreSQL
docker exec segs-postgres pg_isready -U segs_user -d segs_db

# Check TimescaleDB
docker exec segs-timescaledb pg_isready -U segs_user -d segs_db

# Re-seed database
./scripts/seed-db.sh
```

### Kafka Issues

```bash
# Check Kafka health
docker exec segs-kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Recreate topics
./scripts/create-topics.sh
```

### Complete Reset

```bash
# Nuclear option: destroy everything and start fresh
docker compose down -v
docker system prune -af --volumes
docker compose up -d
./scripts/create-topics.sh
./scripts/seed-db.sh
```

---

## Test Credentials

**Password for all:** `password123`

- User: `user@example.com`
- Operator: `operator@example.com`
- Admin: `admin@example.com`

---

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 3000 | http://localhost:3000 |
| Ingestion | 3001 | http://localhost:3001 |
| Stream Processor | 3002 | http://localhost:3002 |
| Tariff | 3003 | http://localhost:3003 |
| Alert | 3004 | http://localhost:3004 |
| Notification | 3005 | http://localhost:3005 |
| Grafana | 3006 | http://localhost:3006 |
| Kafka UI | 8080 | http://localhost:8080 |
| Prometheus | 9090 | http://localhost:9090 |
| PostgreSQL | 5432 | localhost:5432 |
| TimescaleDB | 5433 | localhost:5433 |
| Redis | 6379 | localhost:6379 |
| Kafka (ext) | 29092 | localhost:29092 |

---

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
alias segs-start="cd /path/to/smart-energy-grid && ./scripts/start-segs.sh"
alias segs-stop="cd /path/to/smart-energy-grid && docker compose down"
alias segs-logs="cd /path/to/smart-energy-grid && docker compose logs -f"
alias segs-health="cd /path/to/smart-energy-grid && ./scripts/health-check.sh"
alias segs-sim="cd /path/to/smart-energy-grid && ./scripts/run-simulator.sh"
alias segs-psql="docker exec -it segs-postgres psql -U segs_user -d segs_db"
alias segs-tsdb="docker exec -it segs-timescaledb psql -U segs_user -d segs_db"
alias segs-redis="docker exec -it segs-redis redis-cli"
```

---

**🎯 Pro Tip:** Bookmark http://localhost:3000/docs for instant API reference!
