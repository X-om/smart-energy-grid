# Alert Service

The Alert Service is a critical component of the Smart Energy Grid System (SEGS) responsible for real-time alert detection, management, and incident response coordination.

## Overview

The Alert Service monitors energy grid data streams and automatically detects critical conditions such as:

- **Regional Overloads**: When regional load exceeds 90% for 2 consecutive time windows
- **Meter Outages**: When meters haven't reported data for more than 30 seconds  
- **Anomaly Forwarding**: Passes through anomaly alerts from the stream processor
- **High Consumption**: Detects abnormally high consumption patterns
- **Low Generation**: Monitors regional generation capacity issues

## Architecture

### Core Components

- **Alert Rules Engine**: Configurable rule-based detection system
- **Alert Manager**: Handles alert lifecycle (creation, acknowledgment, resolution)
- **Kafka Integration**: Consumes aggregates and publishes processed alerts
- **PostgreSQL Database**: Persistent alert storage with full audit trail
- **Redis Cache**: Deduplication, last-seen tracking, and overload windows
- **REST API**: Operator interfaces for alert management
- **Prometheus Metrics**: Comprehensive monitoring and observability

### Data Flow

```
Kafka (aggregates_1m, alerts) → Consumer → Rules Engine → Alert Manager → Database
                                                              ↓
                                              Kafka (alerts_processed) ← Producer
                                                              ↓
                                                         Operator API
```

## Features

### Alert Detection
- Real-time processing of energy grid data
- Configurable alert rules with conditions and thresholds
- Intelligent deduplication to prevent alert storms
- Cooldown periods to reduce noise
- Multi-dimensional alerting (region, meter, type)

### Alert Management
- Full alert lifecycle tracking (active → acknowledged → resolved)
- Operator acknowledgment with notes
- Resolution tracking with timestamps
- Bulk operations for efficient management
- Auto-resolution of stale alerts

### Monitoring & Observability
- Prometheus metrics for all key operations
- Structured logging with correlation IDs
- Health checks for all dependencies
- Performance monitoring and SLA tracking

## API Endpoints

### Core Operations
- `GET /operator/alerts` - List alerts with filtering
- `GET /operator/alerts/active` - Get active alerts only
- `GET /operator/alerts/history` - Get resolved alerts
- `GET /operator/alerts/:id` - Get specific alert details
- `POST /operator/alerts/:id/ack` - Acknowledge an alert
- `POST /operator/alerts/:id/resolve` - Resolve an alert
- `POST /operator/alerts/bulk/resolve` - Bulk resolve alerts

### Management & Monitoring
- `GET /operator/alerts/stats` - Alert statistics and metrics
- `POST /operator/alerts/auto-resolve` - Auto-resolve old alerts
- `GET /operator/health` - Service health check
- `GET /health` - Basic health endpoint
- `GET /metrics` - Prometheus metrics

## Configuration

### Environment Variables

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=energy_grid
POSTGRES_USER=energy_user
POSTGRES_PASSWORD=energy_pass

# Cache
REDIS_URL=redis://localhost:6379

# Message Queue
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=alert-group

# Alert Thresholds
ALERT_REGIONAL_OVERLOAD_THRESHOLD=90
ALERT_METER_OUTAGE_THRESHOLD_MS=30000
ALERT_AUTO_RESOLVE_HOURS=24
```

### Alert Rules Configuration

Alert rules are configured programmatically through the Rules Engine:

```typescript
{
  id: 'regional_overload',
  name: 'Regional Overload Detection',
  type: 'REGIONAL_OVERLOAD',
  enabled: true,
  severity: 'high',
  conditions: [{
    field: 'load_percentage',
    operator: 'gt',
    value: 90
  }],
  cooldownMs: 300000 // 5 minutes
}
```

## Database Schema

### Alerts Table
```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    region VARCHAR(50),
    meter_id VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Metrics

### Alert Metrics
- `alerts_total` - Total alerts created by type/severity/region
- `alerts_active_total` - Current active alerts by type/region
- `alert_detection_latency_ms` - Time to detect and create alerts

### Processing Metrics
- `messages_processed_total` - Kafka messages processed by topic/status
- `messages_processing_duration_ms` - Message processing time
- `alert_rule_evaluations_total` - Rule evaluation counts

### System Metrics
- `kafka_connection_status` - Kafka connectivity status
- `postgres_connection_status` - Database connectivity
- `redis_connection_status` - Cache connectivity

## Development

### Setup
```bash
# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Run database migrations
pnpm run migrate

# Start in development mode
pnpm run dev
```

### Testing
```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Test with coverage
pnpm test:coverage
```

### Building
```bash
# Build for production
pnpm build

# Start production build
pnpm start
```

## Production Deployment

### Docker
```bash
# Build image
docker build -t alert-service .

# Run container
docker run -d \
  --name alert-service \
  -p 3004:3004 \
  -e POSTGRES_HOST=postgres \
  -e REDIS_URL=redis://redis:6379 \
  -e KAFKA_BROKERS=kafka:9092 \
  alert-service
```

### Health Checks
The service provides multiple health check endpoints:
- `/health` - Overall service health with dependency status
- `/operator/health` - Alert manager specific health
- `/metrics` - Prometheus metrics for monitoring

### Scaling Considerations
- Kafka consumer group enables horizontal scaling
- Redis clustering for high availability caching
- PostgreSQL read replicas for query scaling
- Stateless design allows load balancing

## Monitoring

### Key Metrics to Monitor
- Alert creation rate and processing latency
- Active alert counts by region and type
- Message processing throughput and errors
- Database and cache connection health
- API response times and error rates

### Alerting on Alerts Service
- High alert creation rates (potential system issues)
- Long processing delays (performance degradation)
- Connection failures (dependency outages)
- High error rates (operational problems)

## Troubleshooting

### Common Issues
1. **High Alert Volume**: Check for faulty sensors or system issues causing alert storms
2. **Processing Delays**: Monitor Kafka lag and database performance
3. **Connection Failures**: Verify network connectivity and credentials
4. **Memory Usage**: Monitor for memory leaks in long-running processes

### Debug Mode
Set `LOG_LEVEL=debug` for detailed operational logging including:
- Rule evaluation details
- Message processing traces
- Database query logs
- Cache operation logs

## Security

### Access Control
- API endpoints require authentication (implement JWT middleware)
- Database access uses dedicated service account
- Redis access restricted to service network
- Kafka topics use SASL authentication

### Data Protection
- Alert data encrypted at rest in PostgreSQL
- Sensitive metadata fields masked in logs
- Network traffic uses TLS encryption
- Regular security updates and vulnerability scanning

## Contributing

1. Follow TypeScript strict mode requirements
2. Add comprehensive tests for new features
3. Update metrics for new operations
4. Document API changes in OpenAPI spec
5. Follow semantic versioning for releases