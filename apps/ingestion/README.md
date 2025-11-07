# Ingestion Service

## 📥 Overview

The **Ingestion Service** is the data ingestion gateway for the Smart Energy Grid Management System (SEGS). It receives telemetry data from thousands of smart meters, validates it, deduplicates readings, and publishes them to Kafka for downstream processing.

## 🎯 Features

- **High-throughput HTTP API** - Handles single and batch telemetry submissions
- **Request Validation** - Zod schema validation against `TelemetryReading` type
- **Redis Deduplication** - Prevents duplicate readings within configurable TTL window
- **Kafka Publishing** - Publishes validated readings to `raw_readings` topic
- **Prometheus Metrics** - Comprehensive observability with custom metrics
- **Structured Logging** - Pino-based JSON logging with pretty-print in development
- **Graceful Shutdown** - Clean connection closure on termination signals
- **Health Checks** - `/health` endpoint for load balancer integration

## 🏗️ Architecture

```
Simulator → POST /telemetry/batch
            ↓
    [Ingestion Service]
    1️⃣ Validate readings (Zod)
    2️⃣ Deduplicate (Redis TTL)
    3️⃣ Publish to Kafka (raw_readings)
    4️⃣ Return response with stats
            ↓
    Kafka Topic: raw_readings
```

## 📡 API Endpoints

### `POST /telemetry`
Submit a single telemetry reading.

**Request Body:**
```json
{
  "readingId": "uuid",
  "meterId": "uuid",
  "timestamp": "ISO8601",
  "voltage": 230.5,
  "current": 12.3,
  "powerFactor": 0.95,
  "frequency": 50.0,
  "activePower": 2750.0,
  "reactivePower": 150.0,
  "apparentPower": 2800.0,
  "energyConsumed": 15.5,
  "region": "Pune-West"
}
```

**Response:**
```json
{
  "status": "success",
  "readingId": "uuid",
  "topic": "raw_readings",
  "partition": 2,
  "offset": "12345"
}
```

### `POST /telemetry/batch`
Submit a batch of telemetry readings (up to 1000).

**Request Body:**
```json
{
  "readings": [
    { /* TelemetryReading */ },
    { /* TelemetryReading */ },
    ...
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "accepted": 500,
  "duplicates": 3,
  "failed": 0,
  "topic": "raw_readings",
  "partitions": [0, 1, 2, 3]
}
```

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "ingestion",
  "timestamp": "ISO8601",
  "uptime": 3600.5,
  "connections": {
    "redis": true,
    "kafka": true
  }
}
```

### `GET /metrics`
Prometheus metrics endpoint.

**Metrics Exposed:**
- `ingestion_requests_total` - Total HTTP requests
- `ingestion_success_total` - Successfully ingested readings (by region)
- `ingestion_errors_total` - Ingestion errors (by type)
- `deduplicated_messages_total` - Duplicate readings filtered
- `kafka_produce_latency_ms` - Kafka publish latency
- `kafka_messages_published_total` - Messages sent to Kafka
- `redis_connection_status` - Redis connection health (1=up, 0=down)
- `kafka_connection_status` - Kafka connection health

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Kafka (running on localhost:29092)
- Redis (running on localhost:6379)

### Installation

```bash
cd apps/ingestion
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and adjust settings:

```bash
cp .env.example .env
```

Key environment variables:
- `PORT` - HTTP server port (default: 3001)
- `KAFKA_BROKERS` - Comma-separated Kafka brokers (default: localhost:29092)
- `KAFKA_TOPIC` - Target Kafka topic (default: raw_readings)
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)
- `DEDUP_TTL` - Deduplication TTL in seconds (default: 60)

### Running Locally

```bash
# Development mode (with rebuild)
pnpm dev

# Production mode
pnpm build
pnpm start
```

### Docker

```bash
# Build image
docker build -t segs-ingestion .

# Run container
docker run -d \
  --name segs-ingestion \
  -p 3001:3001 \
  -e KAFKA_BROKERS=kafka:9092 \
  -e REDIS_URL=redis://redis:6379 \
  segs-ingestion
```

## 🧪 Testing

### Manual Testing

**Test single reading:**
```bash
curl -X POST http://localhost:3001/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "readingId": "550e8400-e29b-41d4-a716-446655440000",
    "meterId": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2025-11-07T10:00:00.000Z",
    "voltage": 230.5,
    "current": 12.3,
    "powerFactor": 0.95,
    "frequency": 50.0,
    "activePower": 2750.0,
    "reactivePower": 150.0,
    "apparentPower": 2800.0,
    "energyConsumed": 15.5,
    "region": "Pune-West"
  }'
```

**Test batch endpoint:**
Use the simulator to send realistic batch data:
```bash
cd ../simulator
pnpm dev -- --target http --iterations 1 --meters 100
```

**Check health:**
```bash
curl http://localhost:3001/health
```

**View metrics:**
```bash
curl http://localhost:3001/metrics
```

### Integration with Simulator

The simulator can send data directly to the ingestion service:

```bash
# In simulator/.env
TARGET=http
INGESTION_URL=http://localhost:3001/telemetry/batch

# Run simulator
cd ../simulator
pnpm dev
```

## 📊 Monitoring

### Prometheus Metrics

Add this scrape config to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'ingestion'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### Key Metrics to Monitor

- **Throughput**: `rate(ingestion_success_total[1m])`
- **Error Rate**: `rate(ingestion_errors_total[1m])`
- **Duplicate Rate**: `rate(deduplicated_messages_total[1m])`
- **Kafka Latency**: `kafka_produce_latency_ms` (p95, p99)
- **Request Duration**: `ingestion_request_duration_ms` (p95, p99)

### Logs

Logs are output in JSON format (production) or pretty-printed (development).

View logs:
```bash
# If running locally
pnpm dev

# If running in Docker
docker logs -f segs-ingestion
```

## 🔧 Troubleshooting

### Kafka Connection Issues

```
Error: Failed to connect Kafka producer
```

**Solutions:**
- Ensure Kafka is running: `docker ps | grep kafka`
- Check broker address: `KAFKA_BROKERS=localhost:29092` (use 29092 for host connections)
- Verify Kafka is accessible: `telnet localhost 29092`

### Redis Connection Issues

```
Error: Redis client error
```

**Solutions:**
- Ensure Redis is running: `docker ps | grep redis`
- Check connection URL: `REDIS_URL=redis://localhost:6379`
- Test connection: `redis-cli ping`

### Validation Errors

```
Validation failed for batch
```

**Solutions:**
- Check request body matches `TelemetryReading` schema
- Ensure all required fields are present
- Verify data types (e.g., voltage must be a number)

## 📈 Performance

### Benchmarks

- **Throughput**: 500+ messages/sec sustained
- **Latency**: <50ms p95 for batch endpoint
- **Deduplication**: <5ms per check
- **Kafka Publish**: <25ms p95

### Optimization Tips

- Use batch endpoint for bulk submissions (up to 1000 readings)
- Duplicate readings are detected in O(1) time via Redis
- Kafka messages are partitioned by `meterId` for ordering
- Connection pooling is handled automatically

## 🏗️ Project Structure

```
apps/ingestion/
├── src/
│   ├── index.ts              # Main entry point
│   ├── server.ts             # Express app configuration
│   ├── routes/
│   │   └── telemetry.ts      # Telemetry endpoints
│   ├── kafka/
│   │   └── producer.ts       # Kafka producer service
│   ├── redis/
│   │   └── dedupe.ts         # Deduplication service
│   ├── utils/
│   │   ├── logger.ts         # Pino logger setup
│   │   └── validate.ts       # Zod validation schemas
│   └── metrics/
│       └── metrics.ts        # Prometheus metrics
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## 🤝 Integration Points

### Upstream
- **Simulator** - Sends batches via `POST /telemetry/batch`

### Downstream
- **Kafka Topic** - `raw_readings` - Published validated telemetry
- **Stream Processor** - Consumes from `raw_readings`

## 📝 License

Part of the Smart Energy Grid Management System (SEGS) project.
