# 🔌 Smart Energy Grid Management System (SEGS)

A large-scale, microservice-based backend system for managing smart energy grids. Built with TypeScript, Turborepo, and modern cloud-native technologies.

## 🏗️ Architecture

This monorepo contains multiple microservices that work together to process energy data, calculate tariffs, detect anomalies, and send notifications.

### Microservices

- **Simulator** - Generates synthetic energy consumption data for testing
- **Ingestion** - Receives and validates incoming energy readings
- **Stream Processor** - Real-time data processing and aggregation
- **Tariff** - Calculates energy costs based on consumption and plans
- **Alert** - Detects anomalies and generates alerts
- **Notification** - Sends notifications via multiple channels
- **API Gateway** - Unified REST API for external clients

### Infrastructure

- **Kafka** - Event streaming backbone
- **Redis** - Caching and session management
- **PostgreSQL** - Relational data storage
- **TimescaleDB** - Time-series data storage
- **Zookeeper** - Kafka coordination

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PNPM >= 8.0.0
- Docker & Docker Compose

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build

# Start infrastructure services
docker-compose up -d

# Wait for services to be healthy, then create Kafka topics
chmod +x scripts/*.sh
./scripts/create-topics.sh

# Seed database with initial data
./scripts/seed-db.sh
```

### Development

```bash
# Run all services in development mode
pnpm dev

# Run a specific service
cd apps/simulator
pnpm dev

# Lint all code
pnpm lint

# Format all code
pnpm format

# Run tests
pnpm test
```

## 📁 Project Structure

```
smart-energy-grid/
├── apps/                      # Microservices
│   ├── simulator/            # Energy data simulator
│   ├── ingestion/            # Data ingestion service
│   ├── stream-processor/     # Real-time stream processing
│   ├── tariff/               # Tariff calculation service
│   ├── alert/                # Alert detection service
│   ├── notification/         # Notification service
│   └── api-gateway/          # API Gateway
├── packages/                  # Shared packages
│   ├── shared-types/         # TypeScript types & interfaces
│   └── utils/                # Common utilities
├── scripts/                   # Utility scripts
│   ├── create-topics.sh      # Create Kafka topics
│   ├── seed-db.sh            # Seed database
│   └── run-simulator.sh      # Run simulator
├── docker-compose.yml         # Infrastructure setup
├── turbo.json                # Turborepo configuration
├── pnpm-workspace.yaml       # PNPM workspace config
└── tsconfig.base.json        # Base TypeScript config
```

## 🗺️ Development Roadmap

### Phase 1: Foundation ✅
- [x] Monorepo setup with Turborepo
- [x] TypeScript configuration
- [x] Docker Compose infrastructure
- [x] Basic service scaffolding

### Phase 2: Core Services (Next)
- [ ] Simulator - Generate realistic energy data
- [ ] Ingestion - HTTP & Kafka endpoints
- [ ] Stream Processor - Real-time aggregation
- [ ] Database schemas & migrations

### Phase 3: Business Logic
- [ ] Tariff calculation engine
- [ ] Alert detection rules
- [ ] Notification channels (email, SMS, webhook)
- [ ] API Gateway with authentication

### Phase 4: Production Ready
- [ ] Kubernetes deployment configs
- [ ] Monitoring & observability
- [ ] CI/CD pipelines
- [ ] Load testing & optimization

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Monorepo**: Turborepo + PNPM Workspaces
- **Messaging**: Apache Kafka
- **Databases**: PostgreSQL, TimescaleDB
- **Cache**: Redis
- **Testing**: Jest
- **Linting**: ESLint + Prettier

## 📊 Infrastructure Services

Access the following services when running locally:

- **Kafka UI**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **TimescaleDB**: localhost:5433
- **Redis**: localhost:6379
- **API Gateway**: http://localhost:3000 (when implemented)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Test specific service
cd apps/simulator
pnpm test

# Test with coverage
pnpm test -- --coverage
```

## 📝 Environment Variables

Each service should have a `.env` file. Example:

```env
NODE_ENV=development
KAFKA_BROKERS=localhost:29092
DATABASE_URL=postgresql://segs_user:segs_password@localhost:5432/segs_db
REDIS_URL=redis://localhost:6379
```

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `pnpm test`
4. Format code: `pnpm format`
5. Submit a pull request

## 📄 License

MIT

---

**Built with ❤️ for the Smart Energy Grid ecosystem**
