# Smart Energy Grid Management System (SEGS)

A production-grade, microservice-based backend system for managing large-scale smart energy grids. The system handles real-time ingestion of telemetry data from thousands of smart meters, performs streaming analytics, calculates dynamic pricing, detects anomalies, and provides comprehensive APIs for users and operators.

## Overview

This project implements a complete backend solution that simulates smart meters, ingests their data at scale, processes it in real-time, and exposes secure REST APIs. Built with TypeScript in a monorepo architecture using modern cloud-native technologies.

### Key Capabilities

- Handles 5,000+ virtual smart meters sending data every 10 seconds
- Real-time stream processing with 1-minute and 15-minute aggregations
- Dynamic tariff calculation based on regional load
- Anomaly detection and alert generation for grid operators
- JWT-based authentication with role-based access control
- Comprehensive REST APIs with OpenAPI documentation
- Prometheus metrics and Grafana dashboards for monitoring

## Architecture

### Microservices

**Simulator**
- Generates realistic telemetry data for 5,000+ virtual smart meters
- Configurable data frequency, load patterns, and scenarios
- Supports HTTP and Kafka delivery modes
- Simulates normal usage, peak demand, and outage conditions

**Ingestion Service**
- Receives telemetry data via HTTP POST endpoints
- Validates incoming readings and enforces schemas
- Publishes validated data to Kafka for downstream processing
- Handles batched readings for high throughput

**Stream Processor**
- Consumes raw telemetry from Kafka in real-time
- Performs time-windowed aggregations (1-minute, 15-minute)
- Calculates statistics: min, max, average, sum, count
- Detects anomalies using baseline deviation analysis
- Stores aggregates in TimescaleDB hypertables

**Tariff Service**
- Calculates dynamic electricity pricing based on load
- Processes regional aggregates to determine tariff adjustments
- Supports admin overrides for emergency pricing
- Publishes tariff updates to Kafka for system-wide propagation
- Caches current tariffs in Redis for fast lookups

**Alert Service**
- Monitors for regional grid overload conditions
- Processes anomaly alerts from stream processor
- Tracks alert lifecycle: active, acknowledged, resolved
- Stores alerts in PostgreSQL with full audit trail
- Publishes alert notifications to downstream services

**Notification Service**
- Receives alert and tariff update events from Kafka
- Sends notifications via multiple channels (email, SMS, webhook)
- Manages user notification preferences
- Handles retry logic for failed deliveries

**API Gateway**
- Unified REST API for all client interactions
- JWT authentication and authorization
- Role-based access control (USER, OPERATOR, ADMIN)
- Routes requests to appropriate backend services
- Serves OpenAPI/Swagger documentation

### Infrastructure Components

**Apache Kafka**
- Event streaming platform for service communication
- Topics: raw_readings, aggregates_1m, aggregates_15m, regional_aggregates, tariff_updates, alerts, anomalies
- Provides durability, scalability, and fault tolerance

**PostgreSQL**
- Primary relational database for transactional data
- Stores: users, authentication, meters, tariffs, alerts, invoices
- Supports referential integrity and ACID transactions

**TimescaleDB**
- Time-series database built on PostgreSQL
- Stores telemetry aggregates with automatic compression
- Hypertables: raw_readings, aggregates_1m, aggregates_15m
- Retention policies for data lifecycle management

**Redis**
- In-memory cache for high-speed data access
- Caches: current tariffs, meter last-seen timestamps, session data
- Supports TTL-based expiration and atomic operations

**Zookeeper**
- Coordination service for Kafka cluster
- Manages Kafka broker metadata and consumer groups

**Prometheus & Grafana**
- Prometheus scrapes metrics from all services
- Grafana provides visualization dashboards
- Monitors: message throughput, latency, error rates, system health

## Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- Node.js 18.0.0 or higher
- PNPM 8.0.0 or higher
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/X-om/smart-energy-grid.git
cd smart-energy-grid
```

2. Install dependencies:
```bash
pnpm install
```

3. Build all packages and services:
```bash
pnpm build
```

### Starting the System

#### Option 1: Quick Start (Recommended)

Use the provided startup script to launch everything automatically:

```bash
./start-segs.sh
```

This script will:
1. Build all Docker images
2. Start infrastructure services (Kafka, PostgreSQL, Redis, etc.)
3. Wait for services to be healthy
4. Create Kafka topics automatically
5. Start all microservices in the correct order
6. Launch the simulator with 5,000 meters, 10-second intervals, normal mode

#### Option 2: Manual Start with Docker Compose

Simply run:

```bash
docker-compose up -d
```

This will start all infrastructure and application services, including:
- All 7 microservices (API Gateway, Ingestion, Stream Processor, Tariff, Alert, Notification, Simulator)
- Infrastructure (Kafka, PostgreSQL, TimescaleDB, Redis, Zookeeper)
- Monitoring (Prometheus, Grafana)

The simulator will automatically start with the following configuration:
- 5,000 virtual meters
- 10-second intervals between readings
- Normal operation mode
- HTTP delivery to Ingestion Service
- Infinite iterations (runs continuously)

#### Option 3: Step-by-Step Manual Start

If you prefer more control:

1. Start infrastructure services:
```bash
docker-compose up -d zookeeper kafka redis postgres timescaledb prometheus grafana
```

2. Wait for services to be healthy (30-60 seconds):
```bash
docker-compose ps
```

3. Create Kafka topics (done automatically by kafka-init service):
```bash
docker-compose up -d kafka-init
```

4. Start application services:
```bash
docker-compose up -d api-gateway ingestion stream-processor tariff alert notification
```

5. Start the simulator:
```bash
docker-compose up -d simulator
```

### Checking System Status

View the status of all services:

```bash
./status-segs.sh
```

Or use Docker Compose:

```bash
docker-compose ps
```

### Viewing Logs

Follow logs for all services:
```bash
docker-compose logs -f
```

Follow logs for a specific service:
```bash
docker-compose logs -f simulator
docker-compose logs -f stream-processor
docker-compose logs -f api-gateway
```

### Stopping the System

Use the stop script:

```bash
./stop-segs.sh
```

This will prompt you to optionally remove volumes (data persistence).

Or use Docker Compose directly:

```bash
# Stop but keep data
docker-compose down

# Stop and remove all data
docker-compose down -v
```

### Running Individual Services

#### In Docker (Production Mode)

To restart a specific service:
```bash
docker-compose restart simulator
docker-compose restart stream-processor
```

To view logs for a specific service:
```bash
docker-compose logs -f api-gateway
```

To rebuild and restart a service after code changes:
```bash
docker-compose up -d --build api-gateway
```

#### In Development Mode (Local)

For local development with hot-reload, you can run services outside Docker:

1. Ensure infrastructure is running:
```bash
docker-compose up -d zookeeper kafka redis postgres timescaledb
```

2. Run a specific service:
```bash
cd apps/api-gateway
pnpm dev
```

Service ports:
- `apps/api-gateway` - Port 3000
- `apps/ingestion` - Port 3001
- `apps/stream-processor` - Port 3002
- `apps/tariff` - Port 3003
- `apps/alert` - Port 3004
- `apps/notification` - Port 3005
- `apps/simulator` - Port 3007

### Accessing Services

Once running, you can access:

- **API Gateway**: http://localhost:3000
- **Swagger Documentation**: http://localhost:3000/api-docs
- **Kafka UI**: http://localhost:8080
- **Grafana**: http://localhost:3006 (admin/admin)
- **Prometheus**: http://localhost:9090
- **PostgreSQL**: localhost:5432 (segs_user/segs_password)
- **TimescaleDB**: localhost:5433 (segs_user/segs_password)
- **Redis**: localhost:6379

## Configuration

Each service can be configured using environment variables. Create a `.env` file in each service directory based on the `.env.example` template.

### Common Environment Variables

```bash
NODE_ENV=development
LOG_LEVEL=info

# Kafka Configuration
KAFKA_BROKERS=localhost:29092
KAFKA_CLIENT_ID=segs-service-name

# Database Configuration
DATABASE_URL=postgresql://segs_user:segs_password@localhost:5432/segs_db
TIMESCALE_URL=postgresql://segs_user:segs_password@localhost:5433/segs_db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

### Simulator Configuration

```bash
METERS=5000              # Number of virtual meters
INTERVAL=10              # Seconds between readings
MODE=normal              # normal | peak | outage
TARGET=http              # http | kafka
BATCH_SIZE=500           # Readings per batch
```

## Project Structure

## Project Structure

```
smart-energy-grid/
├── apps/
│   ├── alert/
│   │   ├── src/
│   │   │   ├── config/           # Configuration management
│   │   │   ├── controllers/      # HTTP route handlers
│   │   │   ├── db/              # Database clients
│   │   │   ├── helpers/         # Business logic processors
│   │   │   ├── kafka/           # Kafka consumers
│   │   │   ├── metrics/         # Prometheus metrics
│   │   │   ├── routes/          # API routes
│   │   │   ├── services/        # Core services
│   │   │   └── index.ts         # Entry point
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── api-gateway/
│   ├── ingestion/
│   ├── notification/
│   ├── simulator/
│   ├── stream-processor/
│   └── tariff/
├── packages/
│   ├── shared-types/
│   │   └── src/
│   │       ├── aggregates.ts    # Aggregate data types
│   │       ├── alert.ts         # Alert types
│   │       ├── kafka-messages.ts # Kafka message schemas
│   │       ├── tariff.ts        # Tariff types
│   │       └── telemetry.ts     # Telemetry types
│   └── utils/
│       └── src/
│           ├── kafka.ts         # Kafka utilities
│           └── logger.ts        # Logging utilities
├── scripts/
│   ├── create-topics.sh         # Initialize Kafka topics
│   ├── init-db.sql              # PostgreSQL schema
│   ├── init-timescale.sql       # TimescaleDB schema
│   └── seed-db.sh               # Seed initial data
├── monitoring/
│   ├── grafana-datasources.yml
│   └── prometheus.yml
├── docker-compose.yml
├── openapi.yaml                 # API specification
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json
```

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Build System**: Turborepo
- **Package Manager**: PNPM Workspaces

### Data Infrastructure
- **Message Broker**: Apache Kafka 7.5.0
- **Relational Database**: PostgreSQL 15
- **Time-Series Database**: TimescaleDB 2.13
- **Cache**: Redis 7
- **Coordination**: Apache Zookeeper 7.5.0

### Observability
- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Logging**: Pino (structured JSON logging)
- **Tracing**: Custom correlation IDs

### Development Tools
- **Testing**: Jest
- **Linting**: ESLint
- **Formatting**: Prettier
- **API Documentation**: OpenAPI 3.0 / Swagger

## API Documentation

The system exposes a comprehensive REST API with the following endpoint categories:

- **Authentication** (10 endpoints): Register, login, verify email, password management
- **User Management** (4 endpoints): Profile, notification settings
- **Telemetry** (10 endpoints): Meter data, consumption history, statistics
- **Tariff** (9 endpoints): Current rates, estimates, forecasts, admin overrides
- **Alerts** (8 endpoints): Alert management, acknowledgment, resolution

Full API documentation is available at `/api-docs` when the API Gateway is running, or see `openapi.yaml` for the complete specification.

## Testing

Run the test suite:

```bash
# All tests
pnpm test

# Specific service
cd apps/stream-processor
pnpm test

# With coverage
pnpm test -- --coverage
```

## Monitoring

Access monitoring dashboards:

1. **Prometheus**: http://localhost:9090
   - View raw metrics
   - Query time-series data
   - Check service health

2. **Grafana**: http://localhost:3006
   - Pre-configured dashboards
   - Service metrics visualization
   - Alert status monitoring

Each service exposes metrics at `/metrics` endpoint:
- Request duration histograms
- Message processing rates
- Error counts
- Custom business metrics

## Database Management

### PostgreSQL

Connect to the main database:
```bash
psql -h localhost -p 5432 -U segs_user -d segs_db
```

Schema includes:
- users, sessions, tokens
- meters, meter_user_assignments
- tariffs, tariff_overrides
- alerts, alert_acknowledgments
- invoices, notification_preferences

### TimescaleDB

Connect to the time-series database:
```bash
psql -h localhost -p 5433 -U segs_user -d segs_db
```

Hypertables:
- `raw_readings` - All meter readings (7-day retention)
- `aggregates_1m` - 1-minute aggregates (30-day retention)
- `aggregates_15m` - 15-minute aggregates (90-day retention)
- `regional_aggregates_15m` - Regional summaries (90-day retention)

## Development

### Code Style

The project uses ESLint and Prettier for consistent code formatting:

```bash
# Lint all code
pnpm lint

# Format all code
pnpm format
```

### Adding a New Service

1. Create service directory in `apps/`
2. Add to `pnpm-workspace.yaml`
3. Create `package.json` with dependencies
4. Extend `tsconfig.base.json`
5. Add to `turbo.json` pipeline
6. Implement service logic
7. Add Dockerfile
8. Update `docker-compose.yml` if needed

## Troubleshooting

### Services won't start

Check Docker containers are healthy:
```bash
docker-compose ps
docker-compose logs kafka
```

### Kafka connection issues

Verify topics are created:
```bash
docker exec -it segs-kafka kafka-topics --bootstrap-server localhost:29092 --list
```

### Database connection errors

Ensure PostgreSQL is accepting connections:
```bash
docker exec -it segs-postgres pg_isready -U segs_user
```

### Clear all data and restart

```bash
docker-compose down -v
docker-compose up -d
./scripts/create-topics.sh
./scripts/seed-db.sh
```

## Production Considerations

For production deployment:

1. Use managed Kafka service (AWS MSK, Confluent Cloud)
2. Deploy PostgreSQL with replication and backups
3. Use Redis Cluster for high availability
4. Implement proper secret management (AWS Secrets Manager, Vault)
5. Set up SSL/TLS for all services
6. Configure rate limiting and DDoS protection
7. Implement comprehensive logging and alerting
8. Use container orchestration (Kubernetes, ECS)
9. Set up CI/CD pipelines
10. Perform load testing and capacity planning

## License

MIT

## Author

Built for Smart Energy Grid Management System evaluation.
