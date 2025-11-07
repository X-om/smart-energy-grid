# 🔌 Telemetry Simulator

> Virtual smart meter telemetry generator for the Smart Energy Grid Management System (SEGS)

## Overview

The Telemetry Simulator is a high-performance microservice that simulates thousands of virtual smart meters generating real-time power consumption data. It supports both HTTP and Kafka delivery modes, making it essential for testing the entire SEGS platform under realistic load conditions.

## Features

- ✅ **Scalable**: Simulate 5,000+ meters without performance degradation
- ✅ **Realistic Data**: Generates power consumption patterns with configurable modes (normal, peak, outage)
- ✅ **Dual Delivery**: Send via HTTP POST or directly to Kafka topics
- ✅ **Configurable**: Extensive CLI and environment variable configuration
- ✅ **Resilient**: Automatic retry with exponential backoff
- ✅ **Observable**: Structured logging with pino and optional Prometheus metrics
- ✅ **Type-Safe**: Full TypeScript implementation using shared types
- ✅ **Production-Ready**: Dockerized with multi-stage builds

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Telemetry Simulator                       │
│                                                             │
│  ┌──────────────┐    ┌─────────────┐    ┌──────────────┐  │
│  │   Meter      │───▶│  Generator  │───▶│    Sender    │  │
│  │ Initialization│    │  (readings) │    │ (HTTP/Kafka) │  │
│  └──────────────┘    └─────────────┘    └──────────────┘  │
│         │                   │                    │         │
│         │                   │                    ▼         │
│         │                   │            ┌──────────────┐  │
│         │                   │            │   Statistics │  │
│         │                   │            │   & Logging  │  │
│         └───────────────────┴────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │           │
                          ▼           ▼
                    HTTP POST     Kafka Topic
                   (Ingestion)   (raw_readings)
```

## Installation

```bash
# From the root of the monorepo
cd apps/simulator

# Install dependencies (handled by pnpm workspace)
pnpm install

# Build the service
pnpm build
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Key configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `METERS` | Number of virtual meters | `5000` |
| `INTERVAL` | Seconds between readings | `10` |
| `MODE` | Simulation mode: `normal`, `peak`, `outage` | `normal` |
| `TARGET` | Delivery target: `http`, `kafka` | `http` |
| `INGESTION_URL` | HTTP endpoint for telemetry | `http://localhost:3001/telemetry/batch` |
| `KAFKA_BROKERS` | Kafka broker addresses | `localhost:9092` |
| `KAFKA_TOPIC` | Kafka topic name | `raw_readings` |
| `REGIONS` | Comma-separated region list | `Pune-West,Mumbai-North,...` |
| `DUPLICATE_RATE` | Duplicate reading rate (0-1) | `0.01` |
| `BATCH_SIZE` | Readings per batch | `500` |
| `CONCURRENCY_LIMIT` | Max concurrent requests | `10` |
| `LOG_LEVEL` | Log level: `debug`, `info`, `warn`, `error` | `info` |

### CLI Arguments

Override environment variables with CLI flags:

```bash
pnpm dev -- --meters 10000 --interval 5 --mode peak --target kafka
```

Available flags:
- `--meters <number>` - Number of virtual meters
- `--interval <seconds>` - Interval between readings
- `--mode <mode>` - Simulation mode
- `--target <target>` - Delivery target
- `--iterations <number>` - Number of cycles (0 = infinite)
- `--help` - Show help message

## Usage

### Development Mode

```bash
# Start with default configuration
pnpm dev

# Start with custom configuration
pnpm dev -- --meters 5000 --interval 10 --mode normal --target http

# Start in peak mode with Kafka
pnpm dev -- --mode peak --target kafka --iterations 100
```

### Production Mode

```bash
# Build first
pnpm build

# Run built version
pnpm start
```

### Docker

```bash
# Build Docker image
docker build -t segs-simulator:latest -f Dockerfile ../..

# Run container
docker run --rm \
  -e METERS=10000 \
  -e MODE=peak \
  -e TARGET=http \
  -e INGESTION_URL=http://ingestion:3001/telemetry/batch \
  segs-simulator:latest
```

## Simulation Modes

### Normal Mode
- **Power Range**: 0.8x - 1.2x base load
- **Use Case**: Standard daily usage patterns
- **Status**: All readings marked as `OK`

```bash
pnpm dev -- --mode normal
```

### Peak Mode
- **Power Range**: 1.5x - 2.0x base load
- **Use Case**: High-demand periods (evening, summer heat)
- **Status**: All readings marked as `OK`

```bash
pnpm dev -- --mode peak
```

### Outage Mode
- **Power Range**: 0x - 0.3x base load (mostly zero)
- **Use Case**: Grid failures, meter outages
- **Status**: 10% marked as `ERROR`, rest as `OK`

```bash
pnpm dev -- --mode outage
```

## Delivery Targets

### HTTP Mode

Sends telemetry readings to the Ingestion Service via batched HTTP POST requests.

**Configuration:**
```env
TARGET=http
INGESTION_URL=http://localhost:3001/telemetry/batch
BATCH_SIZE=500
CONCURRENCY_LIMIT=10
```

**Endpoint Format:**
```http
POST /telemetry/batch HTTP/1.1
Content-Type: application/json

{
  "readings": [...],
  "batchId": "uuid",
  "timestamp": "2025-11-07T10:00:00.000Z"
}
```

### Kafka Mode

Publishes telemetry readings directly to Kafka topics.

**Configuration:**
```env
TARGET=kafka
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=raw_readings
KAFKA_CLIENT_ID=segs-simulator
```

**Message Format:**
- **Key**: `meterId` (for partitioning)
- **Value**: JSON-serialized `TelemetryReading`
- **Timestamp**: Reading timestamp

## Output Examples

### Startup

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🔌  Smart Energy Grid Telemetry Simulator v1.0.0         ║
║                                                               ║
║     Simulating real-time power consumption from thousands    ║
║     of virtual smart meters across multiple regions.         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

[INFO] Initializing telemetry simulator
[INFO] Initializing virtual meters | count=5000 | regions=["Pune-West","Mumbai-North","Delhi-South","Bangalore-East"]
[INFO] Virtual meters initialized | totalMeters=5000 | regionDistribution={"Pune-West":1250,"Mumbai-North":1250,"Delhi-South":1250,"Bangalore-East":1250}
[INFO] Simulator initialized | config={"meters":5000,"interval":10,"mode":"normal","target":"http","regions":["Pune-West","Mumbai-North","Delhi-South","Bangalore-East"],"iterations":"infinite"}
[INFO] 🚀 Starting telemetry simulator | meters=5000 | interval="10s" | mode="normal" | target="http" | url="http://localhost:3001/telemetry/batch"
```

### Running Cycles

```
[INFO] 📊 Cycle complete | cycle=1 | generated=5000 | sent=5000 | errors=0 | latency="120ms" | duration="150ms" | successRate="100.0%"
[INFO] 📊 Cycle complete | cycle=2 | generated=5000 | sent=5000 | errors=0 | latency="115ms" | duration="145ms" | successRate="100.0%"
[INFO] 📊 Cycle complete | cycle=3 | generated=5000 | sent=5000 | errors=0 | latency="118ms" | duration="148ms" | successRate="100.0%"
```

### Summary (Every 10 Cycles)

```
[INFO] 📈 Cumulative Statistics | summary={"totalCycles":10,"totalReadings":50000,"totalSent":50000,"totalErrors":0,"avgLatency":"117ms","uptime":"100s","throughput":"500 readings/s","successRate":"100.0%"}
```

## Data Model

The simulator uses `TelemetryReading` from `@segs/shared-types`:

```typescript
interface TelemetryReading {
  readingId: string;        // UUID v4
  meterId: string;          // MTR-00000001
  userId?: string;          // USR-00000001
  timestamp: string;        // ISO 8601
  powerKw: number;          // Current power in kW
  energyKwh?: number;       // Energy consumed
  voltage?: number;         // Voltage reading
  region: string;           // Geographic region
  seq?: number;             // Sequence number
  status?: 'OK' | 'ERROR';  // Reading status
  metadata?: {              // Additional context
    mode: string;
    baseLoad: number;
  };
}
```

## Performance

### Benchmarks

| Meters | Interval | Throughput | Memory Usage | CPU Usage |
|--------|----------|------------|--------------|-----------|
| 1,000  | 10s      | ~100/s     | ~50MB        | ~5%       |
| 5,000  | 10s      | ~500/s     | ~120MB       | ~15%      |
| 10,000 | 10s      | ~1000/s    | ~200MB       | ~25%      |
| 20,000 | 5s       | ~4000/s    | ~350MB       | ~45%      |

### Optimization Tips

1. **Increase Batch Size**: Larger batches reduce HTTP overhead
   ```env
   BATCH_SIZE=1000
   ```

2. **Adjust Concurrency**: Higher concurrency for better throughput
   ```env
   CONCURRENCY_LIMIT=20
   ```

3. **Use Kafka**: Kafka mode is generally faster than HTTP
   ```env
   TARGET=kafka
   ```

4. **Reduce Logging**: Set log level to `warn` in production
   ```env
   LOG_LEVEL=warn
   ```

## Testing

### Mock Ingestion Endpoint

For testing without the full stack:

```bash
# Start a simple HTTP server that accepts POST requests
npx json-server --watch db.json --port 3001
```

Or use the provided test endpoint:
```env
INGESTION_URL=http://localhost:3001/test
```

### Integration Testing

Test with the actual Ingestion Service:

```bash
# Terminal 1: Start Ingestion Service
cd apps/ingestion
pnpm dev

# Terminal 2: Start Simulator
cd apps/simulator
pnpm dev -- --meters 1000 --interval 5
```

## Troubleshooting

### Connection Refused

```
[ERROR] Failed to send batch after all retries | error="ECONNREFUSED"
```

**Solution**: Ensure the target service (Ingestion/Kafka) is running and accessible.

### Out of Memory

```
[ERROR] JavaScript heap out of memory
```

**Solution**: Reduce the number of meters or increase Node.js heap size:
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
```

### High CPU Usage

**Solution**: Increase the interval or reduce concurrency:
```bash
pnpm dev -- --interval 30 --concurrency-limit 5
```

## Development

### Project Structure

```
apps/simulator/
├── src/
│   ├── index.ts          # Main entry point
│   ├── config.ts         # Configuration loader
│   ├── generator.ts      # Telemetry data generator
│   ├── sender.ts         # HTTP and Kafka senders
│   ├── types.ts          # Internal type definitions
│   └── utils/
│       └── logger.ts     # Structured logging
├── Dockerfile            # Docker build configuration
├── .env.example          # Example environment variables
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

### Adding New Features

1. **New Simulation Mode**: Add to `generator.ts` in `calculatePower()`
2. **New Delivery Target**: Implement `Sender` interface in `sender.ts`
3. **Custom Metrics**: Extend `types.ts` and add to statistics tracking

## Related Services

- **Ingestion Service** (`apps/ingestion`): Receives HTTP telemetry
- **Stream Processor** (`apps/stream-processor`): Consumes Kafka messages
- **Shared Types** (`packages/shared-types`): Common type definitions

## License

Part of the Smart Energy Grid Management System (SEGS) monorepo.

---

**Version:** 1.0.0  
**Maintained by:** SEGS Development Team
