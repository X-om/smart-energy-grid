# Quick Start Guide

## Starting the System

### Fastest Way (One Command)
```bash
./start-segs.sh
```

### Using Docker Compose Directly
```bash
docker-compose up -d
```

That's it! Everything starts automatically including:
- Infrastructure (Kafka, PostgreSQL, TimescaleDB, Redis, Prometheus, Grafana)
- All 7 microservices
- Simulator with 5,000 meters

## Checking Status

```bash
./status-segs.sh
```

Or:
```bash
docker-compose ps
```

## Viewing Logs

All services:
```bash
docker-compose logs -f
```

Specific service:
```bash
docker-compose logs -f simulator
docker-compose logs -f stream-processor
```

## Stopping the System

```bash
./stop-segs.sh
```

Or:
```bash
docker-compose down
```

## Accessing Services

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api-docs |
| Kafka UI | http://localhost:8080 |
| Grafana | http://localhost:3006 (admin/admin) |
| Prometheus | http://localhost:9090 |

## Simulator Configuration

The simulator runs with these settings (configured in docker-compose.yml):

```
METERS: 5000
INTERVAL: 10 seconds
MODE: normal
TARGET: http (sends to Ingestion Service)
ITERATIONS: 0 (infinite - runs continuously)
BATCH_SIZE: 500 readings per batch
```

To change simulator settings, edit the environment variables in `docker-compose.yml` under the `simulator` service.

## Rebuilding After Code Changes

Rebuild and restart a specific service:
```bash
docker-compose up -d --build api-gateway
```

Rebuild all services:
```bash
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker ps

# Check logs for errors
docker-compose logs

# Restart everything
docker-compose down
docker-compose up -d
```

### Kafka connection issues
```bash
# Check Kafka is healthy
docker-compose exec kafka kafka-topics --bootstrap-server localhost:29092 --list

# Recreate topics
docker-compose up -d kafka-init
```

### Database connection errors
```bash
# Check PostgreSQL
docker-compose exec postgres pg_isready -U segs_user

# Check TimescaleDB
docker-compose exec timescaledb pg_isready -U segs_user
```

### Clear all data and restart fresh
```bash
docker-compose down -v
docker-compose up -d
```

## Development Mode

To run services locally for development (with hot-reload):

1. Start only infrastructure:
```bash
docker-compose up -d zookeeper kafka redis postgres timescaledb
```

2. Run service locally:
```bash
cd apps/stream-processor
pnpm dev
```

This allows faster development iterations without rebuilding Docker images.
