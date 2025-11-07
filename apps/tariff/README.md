# Tariff Service - Dynamic Pricing Engine

Real-time dynamic pricing service for the Smart Energy Grid System. Automatically adjusts electricity tariffs based on regional load data and supports manual operator overrides.

## Features

- **Automated Price Adjustment**: Rule-based pricing that responds to load conditions
- **Load-Based Pricing Tiers**: Critical (>90%), High (75-90%), Normal (50-75%), Low (25-50%), Very Low (<25%)
- **Manual Override API**: Operators can manually set prices for any region
- **Real-time Updates**: Tariff changes published to Kafka for downstream services
- **Persistent Storage**: PostgreSQL stores complete tariff history
- **Fast Access**: Redis caches current tariffs for sub-millisecond lookups
- **Comprehensive Monitoring**: Prometheus metrics and health endpoints

## Architecture

```
┌─────────────────────────┐
│  Kafka: aggregates_1m   │
│  (Regional Load Data)   │
└───────────┬─────────────┘
            │
            ▼
   ┌────────────────────┐
   │ Tariff Calculator  │
   │ (Rule-Based Logic) │
   └─────────┬──────────┘
             │
   ┌─────────┼──────────────────┐
   │         │                  │
   ▼         ▼                  ▼
┌──────┐ ┌────────┐  ┌──────────────┐
│ PG   │ │ Redis  │  │    Kafka     │
│(Save)│ │(Cache) │  │tariff_updates│
└──────┘ └────────┘  └──────────────┘
             │
             ▼
   ┌────────────────────┐
   │  Operator API      │
   │  (Manual Override) │
   └────────────────────┘
```

## Pricing Rules

| Load % | Condition | Multiplier | Price @ ₹5.00 base |
|--------|-----------|------------|-------------------|
| >90%   | Critical  | +25%       | ₹6.25             |
| 75-90% | High      | +10%       | ₹5.50             |
| 50-75% | Normal    | 0%         | ₹5.00             |
| 25-50% | Low       | -10%       | ₹4.50             |
| <25%   | Very Low  | -20%       | ₹4.00             |

**Minimum Change Threshold**: ₹0.10 (prevents excessive updates)

## API Endpoints

### Manual Override
```bash
POST /operator/tariff/override
Content-Type: application/json

{
  "region": "Pune-West",
  "newPrice": 6.5,
  "reason": "Peak hour adjustment",
  "operatorId": "OP123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Tariff override applied successfully",
  "data": {
    "tariffId": "uuid",
    "region": "Pune-West",
    "newPrice": 6.5,
    "oldPrice": 5.0
  }
}
```

### Get Current Tariff
```bash
GET /operator/tariff/:region
```

### Get Tariff History
```bash
GET /operator/tariff/:region/history?limit=10
```

### Get All Tariffs
```bash
GET /operator/tariffs/all
```

### Health Check
```bash
GET /health
```

### Metrics
```bash
GET /metrics
```

## Configuration

See `.env.example` for all configuration options.

Key settings:
- `BASE_PRICE`: Base electricity price (default: ₹5.00 per kWh)
- `KAFKA_TOPIC_INPUT`: Topic to consume from (default: `aggregates_1m`)
- `KAFKA_TOPIC_OUTPUT`: Topic to publish to (default: `tariff_updates`)
- `POSTGRES_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

## Database Schema

```sql
CREATE TABLE tariffs (
  tariff_id UUID PRIMARY KEY,
  region TEXT NOT NULL,
  price_per_kwh DOUBLE PRECISION NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  reason TEXT,
  triggered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
cd apps/tariff
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

## Testing

```bash
# Start infrastructure
docker-compose up -d kafka postgres redis

# Start tariff service
cd apps/tariff
pnpm dev

# Test manual override
curl -X POST http://localhost:3003/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{"region":"Mumbai-North","newPrice":6.0,"reason":"Test"}'

# Check current tariff
curl http://localhost:3003/operator/tariff/Mumbai-North

# View metrics
curl http://localhost:3003/metrics | grep tariff_
```

## Docker Deployment

```bash
# Build image
docker build -f apps/tariff/Dockerfile -t segs-tariff .

# Run with docker-compose
docker-compose --profile services up tariff

# View logs
docker logs -f segs-tariff
```

## Metrics

Available at `http://localhost:3003/metrics`:

- `tariff_updates_total`: Total tariff updates by region and trigger type
- `tariff_overrides_total`: Manual overrides by region and operator
- `tariff_current_price{region}`: Current price for each region
- `tariff_calc_latency_ms`: Calculation latency histogram
- `tariff_kafka_messages_consumed_total`: Messages consumed from Kafka
- `tariff_kafka_messages_published_total`: Messages published to Kafka
- `tariff_db_operation_latency_ms`: Database operation latency
- `tariff_postgres_connected`: PostgreSQL connection status
- `tariff_redis_connected`: Redis connection status
- `tariff_kafka_consumer_connected`: Kafka consumer status
- `tariff_kafka_producer_connected`: Kafka producer status

## Performance

- **Throughput**: Processes 1000+ aggregates/second
- **Latency**: <5ms per tariff calculation
- **Cache Hit Rate**: >99% for current tariff lookups
- **Database Write**: <10ms per insert
- **API Response Time**: <50ms for override operations

## Related Services

- **Stream Processor**: Publishes regional aggregates to `aggregates_1m`
- **Billing Service**: Consumes `tariff_updates` for invoice calculation
- **API Gateway**: Exposes tariff data to external clients
- **Notification Service**: Alerts users about price changes

## Troubleshooting

### Service not starting
- Check PostgreSQL and Redis connections
- Verify Kafka broker accessibility
- Review logs for initialization errors

### Tariffs not updating
- Verify `aggregates_1m` topic has messages
- Check load calculation logic in logs
- Ensure minimum change threshold is appropriate

### API errors
- Validate request payload format
- Check operator authentication (if enabled)
- Review API logs for detailed error messages

## License

MIT
