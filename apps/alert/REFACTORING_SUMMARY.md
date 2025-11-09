# Alert Service Refactoring Summary

## Overview
Transformed the alert service from a monolithic 280+ line `index.ts` to a clean, modular architecture with **32-line index.ts**, following the singleton pattern established in other SEGS services.

## Architecture Changes

### Before
```
index.ts (280+ lines)
├── Express setup
├── All middleware
├── All route handlers
├── Kafka consumer logic
├── Kafka producer logic
├── Database logic
├── Redis logic
├── Shutdown handlers
└── Startup logic
```

### After
```
config/
  └── env.ts (15 lines) - Centralized configuration

services/
  ├── postgresService.ts - PostgreSQL singleton with all DB operations
  ├── redisCacheService.ts - Redis singleton for caching/deduplication
  ├── kafkaConsumerService.ts - Kafka consumer singleton
  ├── kafkaProducerService.ts - Kafka producer singleton
  └── alertManagerService.ts - Alert management singleton

controllers/
  ├── healthController.ts - Health check endpoint
  ├── metricsController.ts - Metrics endpoint
  └── operatorController.ts - 9 operator API endpoints

helpers/
  ├── aggregateHelper.ts - Regional aggregate processing logic
  └── alertHelper.ts - Anomaly alert processing logic

routes/
  └── operatorRouter.ts - Express router configuration

lifecycle/
  └── processLifecycle.ts (67 lines) - Init, startup, shutdown

index.ts (32 lines) - Clean main() function only
```

## Key Features

### Data Flow
1. **Consumes** `aggregates_1m_regional` topic (regional power data)
2. **Consumes** `alerts` topic (anomalies from stream-processor)
3. **Detects** regional overload (>90% load for 2 consecutive windows)
4. **Detects** meter outages (>30 seconds no data)
5. **Publishes** to `alerts_processed` topic
6. **Stores** alerts in PostgreSQL
7. **Caches** deduplication markers in Redis

### REST API Endpoints
- `GET /health` - Service health check
- `GET /metrics` - Prometheus metrics
- `GET /operator/alerts` - Query alerts with filters
- `GET /operator/alerts/active` - Get active alerts
- `GET /operator/alerts/history` - Get resolved alerts
- `GET /operator/alerts/stats` - Alert statistics
- `GET /operator/alerts/:id` - Get specific alert
- `POST /operator/alerts/:id/ack` - Acknowledge alert
- `POST /operator/alerts/:id/resolve` - Resolve alert
- `POST /operator/alerts/bulk/resolve` - Bulk resolve alerts
- `POST /operator/alerts/auto-resolve` - Auto-resolve old alerts

### Configuration
All configuration centralized in `config/env.ts`:
- Server settings (port, environment)
- PostgreSQL connection (host, port, database, credentials)
- Redis connection (URL, TTL)
- Kafka settings (brokers, topics, group ID)
- Alert thresholds (overload %, outage seconds, deduplication)

### Alert Types
1. **REGIONAL_OVERLOAD** - High severity, triggered when load >90% for 2 windows
2. **METER_OUTAGE** - Medium severity, triggered when meter silent >30s
3. **anomaly** - Variable severity, forwarded from stream-processor

## Code Quality Improvements
- ✅ Singleton pattern for all services
- ✅ Strict TypeScript typing
- ✅ One-liner formatting for consistency
- ✅ Clean separation of concerns (MVC pattern)
- ✅ Centralized configuration
- ✅ Modular helpers for business logic
- ✅ Lifecycle management (init, start, shutdown)
- ✅ Graceful shutdown handlers

## Testing
```bash
# Start service
pnpm --filter alert dev

# Test health
curl http://localhost:3004/health

# Test metrics
curl http://localhost:3004/metrics

# Query active alerts
curl http://localhost:3004/operator/alerts/active

# Acknowledge alert
curl -X POST http://localhost:3004/operator/alerts/\{id\}/ack \
  -H "Content-Type: application/json" \
  -d '{"acknowledged_by": "operator@grid.com", "note": "Investigating"}'
```

## Benefits
1. **Maintainability** - Clear module boundaries, easy to locate code
2. **Testability** - Each service/controller can be unit tested
3. **Scalability** - Singleton pattern ensures single instance management
4. **Consistency** - Matches architecture of other SEGS services
5. **Readability** - 32-line index.ts vs 280+ before
6. **Correctness** - Now consumes `aggregates_1m_regional` with proper regional data

## Migration Notes
- Old files in `kafka/`, `db/`, `services/`, `routes/` still exist but are replaced by new structure
- Can be safely deleted after verifying new implementation works
- No database schema changes required
- No API contract changes - all endpoints remain the same
