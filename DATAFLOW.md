# Data Flow Architecture

This document describes the end-to-end data flow through the Smart Energy Grid Management System, detailing how telemetry data moves from simulated smart meters through various processing stages to reach end users.

## Overview

The system implements an event-driven architecture using Apache Kafka as the central message broker. Data flows through multiple stages of processing, from raw telemetry ingestion to real-time aggregation, dynamic pricing, anomaly detection, and user notifications.

## Complete Data Pipeline

### Stage 1: Telemetry Generation (Simulator)

**Component**: Simulator Service

**Purpose**: Generate realistic smart meter readings

**Process**:
1. Simulator initializes 5,000 virtual meters distributed across regions
2. Each meter is assigned a unique meter ID and associated with a user
3. Every 10 seconds, the simulator generates telemetry readings for all meters
4. Readings include: voltage, current, power (kW), energy (kWh), power factor, frequency
5. Data can be sent via HTTP POST to Ingestion Service or published directly to Kafka

**Output**:
- Batches of telemetry readings (500 readings per batch)
- Delivery modes: HTTP or Kafka
- Target: Ingestion Service (HTTP) or `raw_readings` topic (Kafka)

**Data Format**:
```json
{
  "meter_id": "MTR-00000001",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "voltage": 230.5,
  "current": 10.2,
  "power_kw": 2.35,
  "energy_kwh": 0.59,
  "power_factor": 0.98,
  "frequency": 50.0,
  "region": "Mumbai-Central"
}
```

### Stage 2: Data Ingestion (Ingestion Service)

**Component**: Ingestion Service (Port 3001)

**Purpose**: Validate and publish telemetry data

**Process**:
1. Receives HTTP POST requests at `/telemetry/batch` endpoint
2. Validates request payload against schema
3. Checks required fields: meter_id, timestamp, voltage, current, power_kw, energy_kwh
4. Enriches data with ingestion timestamp
5. Publishes validated readings to Kafka `raw_readings` topic
6. Returns acknowledgment to simulator

**Input**: 
- HTTP POST with batch of telemetry readings
- Authentication not required for simulator ingestion

**Output**:
- Messages published to Kafka topic: `raw_readings`
- Each message is a single telemetry reading
- Kafka key: meter_id (ensures partitioning by meter)

**Kafka Topic**: `raw_readings`
- Partitions: 6
- Replication Factor: 1
- Retention: 24 hours

### Stage 3: Stream Processing (Stream Processor)

**Component**: Stream Processor Service (Port 3002)

**Purpose**: Real-time aggregation and anomaly detection

**Process Flow**:

**Step 1: Consume Raw Readings**
- Subscribes to Kafka topic: `raw_readings`
- Consumer group: `stream-processor-group`
- Processes messages in real-time as they arrive

**Step 2: Time-Window Aggregation**
- Maintains in-memory aggregation windows
- Two aggregation levels:
  - 1-minute windows: Bucket timestamps to nearest minute
  - 15-minute windows: Bucket timestamps to nearest 15-minute interval
- Tracks statistics per meter per window: count, sum, min, max, average

**Step 3: 1-Minute Aggregation**
- Aggregates all readings within each 1-minute window
- Calculates:
  - reading_count: Number of readings in window
  - energy_kwh_sum: Total energy consumed
  - power_kw_avg: Average power
  - power_kw_min: Minimum power
  - power_kw_max: Maximum power
  - voltage_avg, current_avg, power_factor_avg
- Stores in TimescaleDB table: `aggregates_1m`
- Publishes to Kafka topic: `aggregates_1m`

**Step 4: 15-Minute Aggregation**
- Combines multiple 1-minute windows into 15-minute aggregates
- Uses same statistical calculations
- Stores in TimescaleDB table: `aggregates_15m`
- Publishes to Kafka topic: `aggregates_15m`

**Step 5: Regional Aggregation**
- Groups meters by region
- Calculates regional statistics every 15 minutes
- Computes load percentage based on regional capacity
- Stores in TimescaleDB table: `regional_aggregates_15m`
- Publishes to Kafka topic: `regional_aggregates`

**Step 6: Anomaly Detection**
- Compares current reading against baseline (historical average)
- Detects spikes: >100% increase from baseline
- Detects drops: >50% decrease from baseline
- Identifies unusual patterns
- Publishes anomalies to Kafka topic: `anomalies`

**Outputs**:
- TimescaleDB tables: `aggregates_1m`, `aggregates_15m`, `regional_aggregates_15m`
- Kafka topics: `aggregates_1m`, `aggregates_15m`, `regional_aggregates`, `anomalies`

**Kafka Topics Created**:

1. `aggregates_1m`
   - Contains: Per-meter 1-minute aggregates
   - Consumers: None (stored for historical queries)

2. `aggregates_15m`
   - Contains: Per-meter 15-minute aggregates
   - Consumers: None (stored for historical queries)

3. `regional_aggregates`
   - Contains: Regional statistics every 15 minutes
   - Consumers: Tariff Service, Alert Service

4. `anomalies`
   - Contains: Detected anomaly events
   - Consumers: Alert Service

### Stage 4: Dynamic Tariff Calculation (Tariff Service)

**Component**: Tariff Service (Port 3003)

**Purpose**: Calculate dynamic electricity pricing based on regional load

**Process**:

**Step 1: Consume Regional Aggregates**
- Subscribes to Kafka topic: `regional_aggregates`
- Consumer group: `tariff-service-group`
- Receives regional load data every 15 minutes

**Step 2: Load-Based Pricing**
- Retrieves current tariff for the region from PostgreSQL
- Evaluates load percentage thresholds:
  - Load < 60%: Normal pricing (base rate)
  - Load 60-80%: Moderate pricing (+10%)
  - Load 80-90%: High pricing (+20%)
  - Load > 90%: Peak pricing (+35%)
- Calculates new price per kWh

**Step 3: Tariff Update Decision**
- Compares new calculated price with current cached price (Redis)
- If price change exceeds threshold (2%), triggers update
- Stores new tariff in PostgreSQL `tariffs` table
- Updates Redis cache with new price (TTL: 24 hours)

**Step 4: Admin Overrides**
- Listens for admin override requests via API
- Processes manual tariff adjustments
- Priority: Admin override > Load-based calculation

**Step 5: Publish Tariff Updates**
- Creates tariff update message with:
  - tariff_id
  - region
  - old_price
  - new_price (price_per_kwh)
  - effective_from timestamp
  - reason (load-based or admin-override)
  - triggered_by (system or admin_user_id)
- Publishes to Kafka topic: `tariff_updates`

**Outputs**:
- PostgreSQL table: `tariffs` (historical record)
- Redis cache: Current tariff per region
- Kafka topic: `tariff_updates`

**Kafka Topic**: `tariff_updates`
- Contains: Tariff change events
- Consumers: Notification Service, API Gateway (cache invalidation)
- Message retention: 7 days

### Stage 5: Alert Generation (Alert Service)

**Component**: Alert Service (Port 3004)

**Purpose**: Monitor grid health and generate alerts

**Process**:

**Step 1: Monitor Regional Load**
- Subscribes to Kafka topic: `regional_aggregates`
- Consumer group: `alert-service-group`
- Checks regional load percentage thresholds

**Step 2: Overload Detection**
- If load_percentage > 85% (configurable threshold):
  - Records overload window in Redis
  - Counts consecutive overload windows in last 30 minutes
  - If 3+ windows in 30 minutes, generates OVERLOAD alert

**Step 3: Anomaly Processing**
- Subscribes to Kafka topic: `anomalies`
- Receives anomaly events from Stream Processor
- Validates anomaly severity based on deviation percentage

**Step 4: Alert Creation**
- Generates alert with:
  - type: ANOMALY | THRESHOLD | OUTAGE
  - severity: low | medium | high | critical
  - region
  - meter_id (if applicable)
  - message: Human-readable description
  - metadata: Additional context (baseline, current value, etc.)
- Stores in PostgreSQL table: `alerts`
- Sets status: active

**Step 5: Alert Lifecycle**
- Active: Alert created, awaiting operator action
- Acknowledged: Operator acknowledged, investigating
- Resolved: Issue fixed, operator marked resolved
- Tracks: acknowledged_by, acknowledged_at, resolved_at

**Step 6: Publish Alert Notifications**
- Publishes new alerts to Kafka topic: `alerts`
- Includes full alert details for notification processing

**Outputs**:
- PostgreSQL table: `alerts` (full history with audit trail)
- Redis: Recent alert counts, overload windows
- Kafka topic: `alerts`

**Kafka Topic**: `alerts`
- Contains: Alert events (created, acknowledged, resolved)
- Consumers: Notification Service
- Message retention: 7 days

### Stage 6: Notification Delivery (Notification Service)

**Component**: Notification Service (Port 3005)

**Purpose**: Send notifications to users and operators

**Process**:

**Step 1: Consume Events**
- Subscribes to multiple Kafka topics:
  - `alerts`: Alert notifications
  - `tariff_updates`: Tariff change notifications
- Consumer group: `notification-service-group`

**Step 2: User Preference Lookup**
- Retrieves notification preferences from PostgreSQL
- Checks enabled channels: email, SMS, push, webhook
- Determines which users should be notified based on:
  - Alert type and severity
  - Tariff update region
  - User role (USER, OPERATOR, ADMIN)

**Step 3: Template Selection**
- Selects notification template based on event type
- Templates: alert_created, alert_resolved, tariff_increased, tariff_decreased

**Step 4: Multi-Channel Delivery**
- Sends via configured channels:
  - Email: SMTP integration
  - SMS: Twilio/SNS integration
  - Push: Firebase Cloud Messaging
  - Webhook: HTTP POST to user-defined URLs

**Step 5: Delivery Tracking**
- Records notification attempt in PostgreSQL `notification_log`
- Implements retry logic for failed deliveries (3 attempts, exponential backoff)
- Updates delivery status: pending | sent | failed

**Outputs**:
- PostgreSQL table: `notification_log`
- External systems: Email provider, SMS gateway, Push service

### Stage 7: API Gateway & User Interaction

**Component**: API Gateway (Port 3000)

**Purpose**: Expose REST APIs for users and operators

**Data Retrieval Flows**:

**User Queries Telemetry**:
1. User makes authenticated request: `GET /api/v1/telemetry/user/history`
2. API Gateway validates JWT token, extracts user_id
3. Queries PostgreSQL to find user's assigned meter_id
4. Queries TimescaleDB `aggregates_1m` or `aggregates_15m` for historical data
5. Returns aggregated consumption history

**Operator Views Alerts**:
1. Operator requests: `GET /api/v1/alerts/operator/active`
2. API Gateway validates JWT token, checks role = OPERATOR
3. Queries PostgreSQL `alerts` table with filters: status=active, region
4. Returns list of active alerts requiring attention

**User Checks Current Tariff**:
1. User requests: `GET /api/v1/tariff/user/current`
2. API Gateway determines user's region from meter assignment
3. First checks Redis cache for current tariff
4. If cache miss, queries PostgreSQL `tariffs` table
5. Caches result in Redis with TTL
6. Returns current price per kWh

**Admin Overrides Tariff**:
1. Admin posts: `POST /api/v1/tariff/admin/override`
2. API Gateway validates JWT token, checks role = ADMIN
3. Creates tariff override in PostgreSQL `tariff_overrides` table
4. Publishes override event to Kafka topic: `tariff_overrides`
5. Tariff Service consumes event, applies override immediately
6. New tariff propagates through `tariff_updates` topic

**Operator Acknowledges Alert**:
1. Operator posts: `PUT /api/v1/alerts/operator/{alertId}/acknowledge`
2. API Gateway updates alert in PostgreSQL: status=acknowledged, acknowledged_by, acknowledged_at
3. Publishes status update to Kafka topic: `alerts`
4. Notification Service sends acknowledgment notification to affected users

## Data Storage

### PostgreSQL (Port 5432)

**Transactional Data**:
- users: User accounts and authentication
- meters: Smart meter registry
- meter_user_assignments: Meter ownership mapping
- tariffs: Tariff history and current rates
- tariff_overrides: Admin-applied tariff adjustments
- alerts: Alert records with full lifecycle
- alert_acknowledgments: Operator actions on alerts
- invoices: Billing records
- notification_preferences: User notification settings
- notification_log: Notification delivery tracking
- sessions: Active user sessions
- token_blacklist: Revoked JWT tokens
- otp_verifications: Email/phone verification codes

### TimescaleDB (Port 5433)

**Time-Series Data**:
- raw_readings: All meter readings (7-day retention)
  - Partitioned by time
  - Indexed by meter_id, timestamp
  - Compressed after 24 hours

- aggregates_1m: 1-minute aggregates (30-day retention)
  - Hypertable partitioned by window_start
  - Unique constraint: (meter_id, window_start)
  - Compressed after 7 days

- aggregates_15m: 15-minute aggregates (90-day retention)
  - Hypertable partitioned by window_start
  - Unique constraint: (meter_id, window_start)
  - Compressed after 14 days

- regional_aggregates_15m: Regional statistics (90-day retention)
  - Hypertable partitioned by window_start
  - Unique constraint: (region, window_start)

### Redis (Port 6379)

**Cached Data**:
- Current tariffs per region (Key: `tariff:{region}`, TTL: 24 hours)
- Meter last-seen timestamps (Key: `meter:last_seen:{meter_id}`, TTL: 1 hour)
- User session data (Key: `session:{session_id}`, TTL: 7 days)
- Recent alert counts per region (Key: `alerts:count:{region}`, TTL: 1 hour)
- Overload detection windows (Key: `region:overload:{region}`, TTL: 30 minutes)
- Rate limiting counters (Key: `ratelimit:{user_id}:{endpoint}`, TTL: 1 minute)

## Kafka Topics Summary

**Topic**: `raw_readings`
- Producer: Ingestion Service
- Consumers: Stream Processor
- Retention: 24 hours
- Partitions: 6
- Purpose: Raw telemetry from meters

**Topic**: `aggregates_1m`
- Producer: Stream Processor
- Consumers: None (storage only)
- Retention: 7 days
- Partitions: 3
- Purpose: 1-minute meter aggregates

**Topic**: `aggregates_15m`
- Producer: Stream Processor
- Consumers: None (storage only)
- Retention: 7 days
- Partitions: 3
- Purpose: 15-minute meter aggregates

**Topic**: `regional_aggregates`
- Producer: Stream Processor
- Consumers: Tariff Service, Alert Service
- Retention: 7 days
- Partitions: 3
- Purpose: Regional load statistics

**Topic**: `anomalies`
- Producer: Stream Processor
- Consumers: Alert Service
- Retention: 7 days
- Partitions: 3
- Purpose: Detected anomaly events

**Topic**: `tariff_updates`
- Producer: Tariff Service
- Consumers: Notification Service
- Retention: 7 days
- Partitions: 3
- Purpose: Dynamic pricing changes

**Topic**: `alerts`
- Producer: Alert Service
- Consumers: Notification Service
- Retention: 7 days
- Partitions: 3
- Purpose: Alert lifecycle events

**Topic**: `tariff_overrides`
- Producer: API Gateway
- Consumers: Tariff Service
- Retention: 7 days
- Partitions: 1
- Purpose: Admin tariff overrides

## Data Flow Diagram (Text Representation)

```
┌──────────────┐
│  Simulator   │ Generates 5,000 meters @ 10s interval
└──────┬───────┘
       │ HTTP POST /telemetry/batch
       ▼
┌──────────────────┐
│ Ingestion Service│ Validates & publishes
└──────┬───────────┘
       │ Kafka: raw_readings
       ▼
┌────────────────────┐
│ Stream Processor   │ Real-time aggregation
└─┬─┬─┬─┬────────────┘
  │ │ │ │
  │ │ │ └─► Kafka: anomalies ────────────┐
  │ │ │                                    │
  │ │ └───► Kafka: regional_aggregates ─┐ │
  │ │                                    │ │
  │ └─────► TimescaleDB:                 │ │
  │         - aggregates_1m              │ │
  │         - aggregates_15m             │ │
  │         - regional_aggregates_15m    │ │
  │                                      │ │
  ▼                                      ▼ ▼
┌──────────────┐                    ┌──────────────┐
│    Tariff    │◄───────────────────│    Alert     │
│   Service    │                    │   Service    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ Kafka: tariff_updates             │ Kafka: alerts
       │                                   │
       └───────────┬───────────────────────┘
                   │
                   ▼
          ┌────────────────────┐
          │ Notification Service│ Multi-channel delivery
          └────────────────────┘
                   │
                   ├─► Email
                   ├─► SMS
                   ├─► Push
                   └─► Webhook

┌──────────────┐
│ API Gateway  │◄──── User/Operator HTTP requests
└──────┬───────┘
       │
       ├─► PostgreSQL (users, alerts, tariffs)
       ├─► TimescaleDB (historical aggregates)
       └─► Redis (cached tariffs, sessions)
```

## Performance Characteristics

**Throughput**:
- Simulator: 5,000 meters × 1 reading/10s = 500 readings/second
- Ingestion: Processes batches of 500 readings
- Stream Processor: Handles 500+ messages/second with aggregation
- Tariff Service: Processes regional updates every 15 minutes (4 regions/minute)
- Alert Service: Sub-second alert creation and notification

**Latency**:
- Ingestion to Kafka: < 100ms
- Kafka to Stream Processor: < 50ms
- Aggregation computation: < 200ms
- End-to-end (meter to storage): < 500ms
- Alert generation: < 1 second from anomaly detection

**Scalability**:
- Kafka partitioning enables horizontal scaling of consumers
- TimescaleDB hypertables automatically partition by time
- Redis caching reduces database load by 80%+
- Stateless services can scale independently

## Monitoring & Observability

**Prometheus Metrics** (scraped every 15s):
- Message processing rate per service
- Kafka consumer lag
- Database query latency
- Cache hit/miss ratios
- Alert generation rate
- Tariff update frequency
- API request duration histograms
- Error counts by service and endpoint

**Grafana Dashboards**:
- Real-time throughput monitoring
- Service health status
- Kafka topic lag visualization
- Database performance metrics
- Alert trends over time
- Regional load heatmaps

## Failure Handling & Recovery

**Kafka Consumer Groups**:
- Automatic offset management ensures at-least-once delivery
- Failed messages are retried automatically
- Consumer rebalancing on service restart

**Database Transactions**:
- ACID guarantees for critical operations
- Unique constraints prevent duplicate aggregates
- Foreign key constraints maintain referential integrity

**Idempotency**:
- Aggregates use UPSERT (ON CONFLICT DO UPDATE)
- Duplicate readings don't corrupt statistics
- Alert deduplication based on meter_id + time window

**Circuit Breakers**:
- Services degrade gracefully on downstream failures
- Notification service queues failed deliveries for retry
- API Gateway returns cached data when databases unavailable

**Health Checks**:
- All Docker services have health check endpoints
- Kubernetes readiness/liveness probes (for k8s deployment)
- Automatic service restart on failure

This data flow architecture ensures reliable, scalable, and observable processing of smart meter telemetry data from generation through storage, analysis, and delivery to end users.
