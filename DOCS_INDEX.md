# 📚 Smart Energy Grid Management System - Documentation Index

## 🚀 Getting Started

**New to SEGS? Start here:**

1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Essential commands and quick start
2. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide with examples
3. **[INFRASTRUCTURE_COMPLETE.md](INFRASTRUCTURE_COMPLETE.md)** - Full implementation details

---

## 📖 Documentation by Purpose

### For Developers

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [README.md](README.md) | Project overview and architecture | First time learning about SEGS |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Command cheat sheet | Daily development work |
| [apps/api-gateway/TESTING.md](apps/api-gateway/TESTING.md) | API testing examples | Testing REST endpoints |
| [apps/api-gateway/IMPLEMENTATION_SUMMARY.md](apps/api-gateway/IMPLEMENTATION_SUMMARY.md) | API Gateway features | Understanding API structure |

### For DevOps/Infrastructure

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment procedures | Setting up the system |
| [INFRASTRUCTURE_COMPLETE.md](INFRASTRUCTURE_COMPLETE.md) | Infrastructure details | Understanding the stack |
| [docker-compose.yml](docker-compose.yml) | Service orchestration | Customizing deployment |
| [monitoring/prometheus.yml](monitoring/prometheus.yml) | Metrics configuration | Setting up monitoring |

### For Operators

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Operations commands | Daily operations |
| [scripts/health-check.sh](scripts/health-check.sh) | System health validation | Troubleshooting |
| [DEPLOYMENT.md](DEPLOYMENT.md) - Troubleshooting section | Problem resolution | When things go wrong |

---

## 🗂️ Files by Category

### Configuration Files

```
docker-compose.yml              # Complete stack orchestration
.env.example                    # Environment variable reference
monitoring/prometheus.yml       # Prometheus scrape configuration
monitoring/grafana-datasources.yml  # Grafana datasource config
```

### Database Schemas

```
scripts/init-db.sql             # PostgreSQL tables and indexes
scripts/init-timescale.sql      # TimescaleDB hypertables and policies
```

### Automation Scripts

```
scripts/start-segs.sh           # ⭐ Main startup script (use this!)
scripts/create-topics.sh        # Kafka topic creation
scripts/seed-db.sh              # Database seeding with test data
scripts/run-simulator.sh        # Simulator launcher
scripts/health-check.sh         # System health validation
```

### Documentation

```
README.md                       # Main project documentation
DEPLOYMENT.md                   # Comprehensive deployment guide
QUICK_REFERENCE.md              # Quick command reference
INFRASTRUCTURE_COMPLETE.md      # Implementation summary
```

### Service-Specific Docs

```
apps/api-gateway/TESTING.md              # API Gateway testing guide
apps/api-gateway/IMPLEMENTATION_SUMMARY.md  # API features list
```

---

## 🎯 Common Tasks

### Starting the System

**Quickest way (recommended):**
```bash
./scripts/start-segs.sh
```

**See:** [DEPLOYMENT.md - Quick Start](DEPLOYMENT.md#quick-start)

### Testing APIs

**Reference:** [apps/api-gateway/TESTING.md](apps/api-gateway/TESTING.md)

**Quick example:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.data.token')

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/me | jq .
```

**See:** [QUICK_REFERENCE.md - API Testing](QUICK_REFERENCE.md#api-testing)

### Monitoring

**Access Points:**
- Swagger UI: http://localhost:3000/docs
- Kafka UI: http://localhost:8080
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3006

**See:** [DEPLOYMENT.md - Monitoring & Observability](DEPLOYMENT.md#monitoring--observability)

### Troubleshooting

**Quick health check:**
```bash
./scripts/health-check.sh
```

**See:** [DEPLOYMENT.md - Troubleshooting](DEPLOYMENT.md#troubleshooting)

**Also:** [QUICK_REFERENCE.md - Troubleshooting](QUICK_REFERENCE.md#troubleshooting)

---

## 🏗️ Architecture Documentation

### System Overview

```
Simulator → Ingestion → Stream Processor → Tariff/Alert/Notification → API Gateway
                ↓              ↓                    ↓
             Kafka     TimescaleDB/PostgreSQL    Redis
```

**Detailed architecture:** [INFRASTRUCTURE_COMPLETE.md - System Architecture](INFRASTRUCTURE_COMPLETE.md#-system-architecture)

### Microservices

| Service | Port | Documentation |
|---------|------|---------------|
| API Gateway | 3000 | [apps/api-gateway/](apps/api-gateway/) |
| Ingestion | 3001 | [apps/ingestion/](apps/ingestion/) |
| Stream Processor | 3002 | [apps/stream-processor/](apps/stream-processor/) |
| Tariff | 3003 | [apps/tariff/](apps/tariff/) |
| Alert | 3004 | [apps/alert/](apps/alert/) |
| Notification | 3005 | [apps/notification/](apps/notification/) |
| Simulator | - | [apps/simulator/](apps/simulator/) |

---

## 📊 Data Flow Documentation

### Telemetry Flow

1. **Simulator** generates meter readings
2. **Ingestion** validates and publishes to Kafka (`raw_readings`)
3. **Stream Processor** aggregates into 1m/15m windows
4. **TimescaleDB** stores time-series data
5. **Tariff Service** calculates costs
6. **Alert Service** detects anomalies
7. **Notification** broadcasts alerts via WebSocket
8. **API Gateway** exposes unified REST API

**Detailed flow:** [INFRASTRUCTURE_COMPLETE.md - Data Flow](INFRASTRUCTURE_COMPLETE.md#-data-flow)

---

## 🔐 Security Documentation

**Topics covered:**
- JWT authentication
- Role-based access control (RBAC)
- Password hashing (bcrypt)
- Rate limiting
- CORS configuration

**See:** [INFRASTRUCTURE_COMPLETE.md - Security Features](INFRASTRUCTURE_COMPLETE.md#-security-features)

---

## 📈 Monitoring Documentation

### Metrics

All services expose Prometheus metrics at `/metrics`

**Configuration:** [monitoring/prometheus.yml](monitoring/prometheus.yml)

**Access:** http://localhost:9090

### Dashboards

Grafana pre-configured with Prometheus datasource

**Access:** http://localhost:3006 (admin/admin)

**See:** [DEPLOYMENT.md - Monitoring](DEPLOYMENT.md#monitoring--observability)

---

## 🧪 Testing Documentation

### API Testing

**Complete guide:** [apps/api-gateway/TESTING.md](apps/api-gateway/TESTING.md)

**Quick reference:** [QUICK_REFERENCE.md - API Testing](QUICK_REFERENCE.md#api-testing)

### Load Testing

**Simulator for high load:**
```bash
./scripts/run-simulator.sh --meters 5000 --interval 1000
```

**See:** [DEPLOYMENT.md - Testing Scenarios](DEPLOYMENT.md#testing-scenarios)

---

## 🚢 Production Documentation

**Production considerations:** [INFRASTRUCTURE_COMPLETE.md - Production Deployment Checklist](INFRASTRUCTURE_COMPLETE.md#-production-deployment-checklist)

**Topics:**
- Security hardening
- Scalability planning
- Reliability measures
- Monitoring setup

---

## 📞 Support Resources

### Quick Links

- **API Documentation:** http://localhost:3000/docs
- **Kafka UI:** http://localhost:8080
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3006

### Test Credentials

**Password:** `password123`

- User: `user@example.com`
- Operator: `operator@example.com`
- Admin: `admin@example.com`

### Command Help

```bash
./scripts/start-segs.sh --help
./scripts/run-simulator.sh --help
./scripts/health-check.sh
```

---

## 🗺️ Navigation Tips

1. **Starting from scratch?** → [README.md](README.md)
2. **Want to deploy?** → [DEPLOYMENT.md](DEPLOYMENT.md)
3. **Need quick commands?** → [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
4. **Testing APIs?** → [apps/api-gateway/TESTING.md](apps/api-gateway/TESTING.md)
5. **Understanding implementation?** → [INFRASTRUCTURE_COMPLETE.md](INFRASTRUCTURE_COMPLETE.md)
6. **Troubleshooting?** → [DEPLOYMENT.md - Troubleshooting](DEPLOYMENT.md#troubleshooting)

---

## 📝 Document Updates

This index was last updated: **November 7, 2024**

All documentation is co-located with the codebase in `/tmp/smart-energy-grid/`

---

**🎉 Happy coding! The Smart Energy Grid System is ready for action.**
