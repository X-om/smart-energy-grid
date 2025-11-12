# Smart Energy Grid System - Complete Data Flow Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Data Flow Pipeline](#data-flow-pipeline)
3. [Service-by-Service Breakdown](#service-by-service-breakdown)
4. [Data Transformations](#data-transformations)
5. [Database Schemas](#database-schemas)
6. [Kafka Topics](#kafka-topics)
7. [Sample Data Examples](#sample-data-examples)

---

## 🔄 System Overview

The Smart Energy Grid System processes telemetry data from thousands of virtual smart meters through a multi-stage pipeline with multiple Kafka topics:

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Simulator   │ --> │  Ingestion   │ --> │      Kafka        │ --> │     Stream      │
│   Service    │ HTTP│   Service    │     │ telemetry-readings│     │   Processor     │
└──────────────┘     └──────────────┘     └───────────────────┘     └─────────────────┘
                            │                                                 │
                            v                                                 │
                     ┌─────────────┐                                          │
                     │    Redis    │                              ┌───────────┴───────────┐
                     │(Deduplication)                             │                       │
                     └─────────────┘                              v                       v
                                                         ┌─────────────────┐    ┌──────────────────┐
                                                         │ Anomaly Detect  │    │   Aggregation    │
                                                         │  (Baseline)     │    │ (1m, 15m, Region)│
                                                         └────────┬────────┘    └────────┬─────────┘
                                                                  │                      │
                                       ┌──────────────────────────┼──────────────────────┼──────┐
                                       │                          │                      │      │
                                       v                          v                      v      v
                              ┌────────────────┐        ┌─────────────────┐    ┌──────────────────────┐
                              │     Kafka      │        │     Kafka       │    │   TimescaleDB        │
                              │    'alerts'    │        │  'aggregates_*' │    │ (aggregates_1m/15m)  │
                              └────────┬───────┘        │  'aggregates_1m_│    └──────────────────────┘
                                       │                │    regional'    │
                                       │                └────────┬────────┘
                                       │                         │
                       ┌───────────────┴──────────┐      ┌───────┴───────────────┐
                       │                          │      │                       │
                       v                          │      v                       v
              ┌─────────────────┐                 │  ┌──────────────┐   ┌───────────────┐
              │ Alert Service   │<────────────────┘  │Tariff Service│   │   Future:     │
              │ - Overload Det. │                    │- Dynamic Price│   │  Analytics    │
              │ - PostgreSQL    │                    │- PostgreSQL   │   └───────────────┘
              │ - Redis Dedupe  │                    │- Redis Cache  │
              └────────┬────────┘                    └───────┬───────┘
                       │                                     │
                       v                                     v
              ┌─────────────────┐                   ┌─────────────────┐
              │     Kafka       │                   │     Kafka       │
              │'alerts_processed│                   │'tariff_updates' │
              │ 'alert_status_* │                   └─────────────────┘
              └─────────────────┘
                       │
                       v
              ┌─────────────────┐
              │  Notification   │
              │   Service       │
              │   (TODO)        │
              └─────────────────┘
```

---

## 🚀 Data Flow Pipeline

### Stage 1: Data Generation (Simulator)
**Service:** `apps/simulator`  
**Purpose:** Generate realistic telemetry readings from virtual smart meters

#### Input: None (generates data)

#### Output Format:
```typescript
interface TelemetryReading {
  readingId: string;      // UUID (e.g., "a1b2c3d4-...")
  meterId: string;        // "MTR-00000001" to "MTR-99999999"
  userId?: string;        // "USR-00000001" (2 meters per user)
  timestamp: string;      // ISO 8601 (e.g., "2025-11-12T06:30:00.000Z")
  powerKw: number;        // 0.0 - 20.0 kW (3 decimal places)
  energyKwh: number;      // Calculated: (powerKw * interval) / 3600
  voltage: number;        // 210.0 - 250.0 V (1 decimal place)
  region: string;         // "Mumbai-North", "Delhi-South", etc.
  seq: number;            // Sequence number per meter
  status: string;         // "OK" or "ERROR"
  metadata: {
    mode: string;         // "normal", "peak", or "outage"
    baseLoad: number;     // Baseline consumption for this meter
  }
}
```

#### Sample Generated Data:
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "userId": "USR-00000021",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "energyKwh": 0.0435,
  "voltage": 235.6,
  "region": "Mumbai-North",
  "seq": 1523,
  "status": "OK",
  "metadata": {
    "mode": "normal",
    "baseLoad": 4.5
  }
}
```

#### Code Location:
- **Generator:** `apps/simulator/src/generator.ts`
- **Data Model:** `apps/simulator/src/types.ts`
- **Sender:** `apps/simulator/src/sender.ts`

#### Key Functions:
- `generateReadings()` - Creates telemetry readings for all meters
- `generateReading()` - Generates single reading based on simulation mode
- `calculatePower()` - Computes power based on base load and mode

---

### Stage 2: Data Ingestion & Validation (Ingestion Service)
**Service:** `apps/ingestion`  
**Purpose:** Validate, deduplicate, and publish telemetry data to Kafka

#### Input: HTTP POST to `/telemetry/batch`
```json
[
  {
    "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
    "meterId": "MTR-00000042",
    "region": "Mumbai-North",
    "timestamp": "2025-11-12T06:30:00.000Z",
    "powerKw": 5.234,
    "voltage": 235.6
  }
]
```

#### Validation (Zod)
**File:** `apps/ingestion/src/schemas/zodSchemas.ts`

**Schema:**
```typescript
const readingSchema = z.object({
  readingId: z.string().min(1, 'Reading ID is required'),
  meterId: z.string().min(1, 'Meter ID is required'),
  region: z.string().min(1, 'Region is required'),
  timestamp: z.string().datetime('Invalid timestamp format'),
  powerKw: z.number().min(0, 'Power must be positive'),
  voltage: z.number().min(0, 'Voltage must be positive').optional(),
  current: z.number().min(0, 'Current must be positive').optional(),
  frequency: z.number().min(0, 'Frequency must be positive').optional(),
  powerFactor: z.number().min(0).max(1).optional(),
  temperature: z.number().optional(),
});

const batchReadingsSchema = z.array(readingSchema)
  .min(1, 'Batch must contain at least one reading')
  .max(1000, 'Batch size cannot exceed 1000 readings');
```

**Validation Rules:**
- ✅ `readingId` must be non-empty string
- ✅ `meterId` must be non-empty string
- ✅ `region` must be non-empty string
- ✅ `timestamp` must be valid ISO 8601 datetime
- ✅ `powerKw` must be ≥ 0
- ✅ Optional fields: voltage, current, frequency, powerFactor, temperature
- ✅ Batch size: 1-1000 readings

**Validation Location:**
- **Schema:** `apps/ingestion/src/schemas/zodSchemas.ts`
- **Middleware:** `apps/ingestion/src/middlewares/validateRequest.ts`

#### Deduplication (Redis)
**File:** `apps/ingestion/src/services/redisDedupe.ts`

**How it works:**
1. Generate unique key: `reading:{meterId}:{timestamp}`
2. Try to SET key with NX (only if not exists) and EX (expiry)
3. If SET succeeds → unique reading
4. If SET fails → duplicate reading

**Example:**
```typescript
// Reading 1: MTR-00000042 @ 2025-11-12T06:30:00.000Z
Redis SET reading:MTR-00000042:2025-11-12T06:30:00.000Z "1" NX EX 60
Result: OK → Unique ✅

// Reading 2 (duplicate): same meter & timestamp
Redis SET reading:MTR-00000042:2025-11-12T06:30:00.000Z "1" NX EX 60
Result: null → Duplicate ❌
```

**Configuration:**
- **TTL:** 60 seconds (configurable via `REDIS_DEDUPE_TTL`)
- **Connection:** `apps/ingestion/src/config/env.ts`

**Code Functions:**
- `checkAndMark()` - Check and mark single reading
- `filterDuplicates()` - Filter array of readings
- **Location:** `apps/ingestion/src/services/redisDedupe.ts`

#### Data Transformation
**Before Kafka publish, data is enriched:**

**Input (from simulator):**
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "voltage": 235.6,
  "region": "Mumbai-North"
}
```

**Output (published to Kafka):**
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "voltage": 235.6,
  "region": "Mumbai-North",
  "receivedAt": "2025-11-12T06:30:01.234Z"  ← ADDED
}
```

**Transformation Location:**
- **File:** `apps/ingestion/src/services/kafkaProducer.ts`
- **Function:** `publishBatch()` and `publishReading()`
- **Line:** Adds `receivedAt: new Date().toISOString()` timestamp

#### Output: Kafka Message
**Topic:** `telemetry-readings`  
**Key:** `meterId` (for partitioning)  
**Value:** JSON string with `receivedAt` added

**Controller Location:**
- **File:** `apps/ingestion/src/controllers/telemetry/telemetryOperationalController.ts`
- **Function:** `batchTelemetryReadingController()`

---

### Stage 3: Stream Processing (Stream Processor)
**Service:** `apps/stream-processor`  
**Purpose:** Consume telemetry from Kafka, detect anomalies, aggregate data, publish to multiple Kafka topics, and store in TimescaleDB

#### Input: Kafka Messages
**Topic:** `telemetry-readings`  
**Format:** Same as ingestion output (with `receivedAt`)

#### Processing Steps:

**1. Consume from Kafka**
- **File:** `apps/stream-processor/src/kafka/consumer.ts`
- **Consumer Group:** `stream-processor-group`
- **Function:** `handleMessage()` - Parses JSON and validates structure

**2. Anomaly Detection**
- **File:** `apps/stream-processor/src/services/anomalyDetector.ts`
- **Function:** `checkReading()` - Detects consumption anomalies
- **Detects:**
  - **Power Spikes:** >100% increase from baseline
  - **Power Drops:** >50% decrease from baseline  
  - **Possible Outages:** Near-zero consumption when baseline > 1.0 kW

**Example Anomaly Detection:**
```typescript
// Reading: powerKw = 12.5, baseline = 5.0
// Change = (12.5 - 5.0) / 5.0 = 1.5 (150% increase)
// Result: SPIKE detected → Severity: high

Alert Created:
{
  id: "uuid-v4",
  type: "ANOMALY",
  severity: "high",
  meter_id: "MTR-00000042",
  region: "Mumbai-North",
  timestamp: "2025-11-12T06:30:15.000Z",
  message: "Sudden power consumption spike: 150.0% increase (baseline: 5.00 kW, current: 12.50 kW)",
  metadata: {
    baseline: 5.0,
    current: 12.5,
    change: 150.0,
    type: "spike"
  }
}
```

**Anomaly Types:**
- **SPIKE:** Change > 100% → severity: high (if >200%) or medium
- **DROP:** Change < -50% → severity: medium (if <-80%) or low
- **OUTAGE:** Power < 0.1 kW with baseline > 1.0 kW → severity: high

**Configuration:**
```typescript
{
  spikeThreshold: 1.0,    // 100% increase
  dropThreshold: 0.5,     // 50% decrease
  minSampleSize: 10       // Min readings before detecting
}
```

**File:** `apps/stream-processor/src/helpers/processorsHelper.ts`

**3. Publish Alerts to Kafka**
When anomaly detected:
- **File:** `apps/stream-processor/src/kafka/producer.ts`
- **Function:** `publishAlert()`
- **Topic:** `alerts` (consumed by Alert Service)
- **Key:** `meter_id`
- **Headers:** `{ type, severity, region }`

**4. In-Memory Aggregation**
- **File:** `apps/stream-processor/src/services/aggregator.ts`
- **Function:** `processReading()` - Updates in-memory windows

**How it works:**
```typescript
// 1-minute bucket: Round timestamp to nearest minute
// Input: "2025-11-12T06:30:45.123Z"
// Bucket: "2025-11-12T06:30:00.000Z"

// 15-minute bucket: Round timestamp to nearest 15 minutes
// Input: "2025-11-12T06:30:45.123Z"
// Bucket: "2025-11-12T06:30:00.000Z"
// Input: "2025-11-12T06:45:45.123Z"
// Bucket: "2025-11-12T06:45:00.000Z"
```

**Aggregate Window Structure:**
```typescript
interface AggregateWindow {
  meterId: string;
  region: string;
  powerSum: number;       // Sum of all power readings
  maxPower: number;       // Max power in window
  minPower: number;       // Min power in window
  energySum: number;      // Sum of energy
  voltageSum: number;     // Sum of voltage (for averaging)
  voltageCount: number;   // Count of voltage readings
  count: number;          // Total readings in window
}
```

**Example Aggregation:**
```
Reading 1: powerKw=5.2, voltage=235.6
Reading 2: powerKw=5.5, voltage=238.1
Reading 3: powerKw=5.0, voltage=236.8

Aggregate:
  powerSum = 15.7
  maxPower = 5.5
  minPower = 5.0
  energySum = 0.131
  voltageSum = 710.5
  voltageCount = 3
  count = 3
  
  avgPowerKw = 15.7 / 3 = 5.233
  voltageAvg = 710.5 / 3 = 236.833
```

**5. Flush to TimescaleDB**
**File:** `apps/stream-processor/src/db/timescale.ts`

**1-Minute Aggregates:**
```sql
INSERT INTO aggregates_1m (
  meter_id, region, window_start, 
  avg_power_kw, max_power_kw, min_power_kw, 
  energy_kwh_sum, voltage_avg, count
) VALUES (
  'MTR-00000042', 'Mumbai-North', '2025-11-12T06:30:00Z',
  5.233, 5.5, 5.0,
  0.131, 236.833, 3
)
ON CONFLICT (meter_id, window_start) 
DO UPDATE SET
  avg_power_kw = EXCLUDED.avg_power_kw,
  max_power_kw = EXCLUDED.max_power_kw,
  ...
```

**15-Minute Aggregates:**
Same structure, different table (`aggregates_15m`)

**Flush Intervals:**
- **1-minute:** Every 60 seconds (configurable via `FLUSH_INTERVAL_1M`)
- **15-minute:** Every 900 seconds (configurable via `FLUSH_INTERVAL_15M`)

**6. Publish Aggregates to Kafka**
**File:** `apps/stream-processor/src/controllers/flushController.ts`

**Per-Meter 1-Minute Aggregates:**
- **Function:** `flush1mAggregates()`
- **Topic:** `aggregates_1m`
- **Key:** `meterId`
- **Value:**
```json
{
  "meterId": "MTR-00000042",
  "region": "Mumbai-North",
  "windowStart": "2025-11-12T06:30:00.000Z",
  "avgPowerKw": 5.233,
  "maxPowerKw": 5.5,
  "energyKwhSum": 0.131,
  "count": 3
}
```

**Regional 1-Minute Aggregates:**
- **Function:** `flush1mAggregates()`
- **Topic:** `aggregates_1m_regional` (consumed by Tariff Service)
- **Key:** `region`
- **Value:**
```json
{
  "region": "Mumbai-North",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "meter_count": 1523,
  "total_consumption": 7892.45,
  "avg_consumption": 5.18,
  "max_consumption": 18.5,
  "min_consumption": 0.2,
  "load_percentage": 78.5,
  "active_meters": ["MTR-001", "MTR-002", ...]
}
```

**15-Minute Aggregates:**
- **Function:** `flush15mAggregates()`
- **Topic:** `aggregates_15m`
- **Key:** `meterId`

**Code Location:**
- **Aggregator:** `apps/stream-processor/src/services/aggregator.ts`
- **TimescaleDB Writer:** `apps/stream-processor/src/db/timescale.ts`
- **Flush Controller:** `apps/stream-processor/src/controllers/flushController.ts`
- **Kafka Producer:** `apps/stream-processor/src/kafka/producer.ts`
- **Lifecycle:** `apps/stream-processor/src/lifecycle/processLifecycle.ts`

---

## 🚨 Stage 4: Alert Service
**Service:** `apps/alert`  
**Purpose:** Consume anomaly alerts from Kafka, process and store in PostgreSQL, publish status updates

#### Input: Kafka Messages
**Topics Consumed:**
1. **`alerts`** - Anomaly alerts from Stream Processor
2. **`aggregates_1m_regional`** - Regional aggregates for overload detection

#### Alert Processing

**1. Consume Anomaly Alerts**
- **File:** `apps/alert/src/services/kafkaConsumerService.ts`
- **Consumer Group:** `alert-group`
- **Topic:** `alerts`

**Sample Incoming Alert:**
```json
{
  "id": "a1b2c3d4-...",
  "type": "ANOMALY",
  "severity": "high",
  "meter_id": "MTR-00000042",
  "region": "Mumbai-North",
  "timestamp": "2025-11-12T06:30:15.000Z",
  "message": "Sudden power consumption spike: 150.0% increase",
  "metadata": {
    "baseline": 5.0,
    "current": 12.5,
    "change": 150.0,
    "type": "spike"
  }
}
```

**2. Process Alert**
- **File:** `apps/alert/src/helpers/alertHelper.ts`
- **Function:** `processAnomalyAlert()`
- **Steps:**
  1. Deduplicate using Redis (TTL: 5 minutes)
  2. Validate alert structure
  3. Store in PostgreSQL `alerts` table
  4. Publish to Kafka topic `alerts_processed`

**3. Process Regional Aggregates for Overload Detection**
- **File:** `apps/alert/src/helpers/aggregateHelper.ts`
- **Function:** `processRegionalAggregate()`
- **Detects:**
  - **Regional Overload:** Load > 90% of capacity for 2+ consecutive windows

**Example Overload Detection:**
```typescript
// Regional aggregate: load_percentage = 92%
// Threshold: 90%
// Consecutive windows: 2
// Result: OVERLOAD alert created

Alert:
{
  id: "uuid-v4",
  type: "OVERLOAD",
  severity: "critical",
  region: "Mumbai-North",
  message: "Regional grid overload: 92.0% capacity",
  metadata: {
    load_percentage: 92.0,
    total_consumption: 294400,
    capacity: 320000
  }
}
```

**4. Alert Deduplication (Redis)**
- **Key Pattern:** `alert:dedupe:{meterId}:{type}:{timestamp_bucket}`
- **TTL:** 300 seconds (5 minutes)
- **File:** `apps/alert/src/services/alertManagerService.ts`

**5. Store in PostgreSQL**
```sql
INSERT INTO alerts (
  id, type, severity, region, meter_id, message, 
  timestamp, status, metadata, created_at
) VALUES (
  'uuid-v4', 'ANOMALY', 'high', 'Mumbai-North', 'MTR-00000042',
  'Sudden power consumption spike: 150.0% increase',
  '2025-11-12T06:30:15.000Z', 'active',
  '{"baseline": 5.0, "current": 12.5}',
  NOW()
);
```

**6. Publish to Kafka**
**Topics:**
- **`alerts_processed`** - Processed alerts (consumed by Notification Service)
- **`alert_status_updates`** - Status changes (acknowledged/resolved)

**Sample Processed Alert:**
```json
{
  "alertId": "a1b2c3d4-...",
  "type": "ANOMALY",
  "severity": "high",
  "meterId": "MTR-00000042",
  "region": "Mumbai-North",
  "message": "Sudden power consumption spike: 150.0% increase",
  "status": "active",
  "timestamp": "2025-11-12T06:30:15.000Z",
  "processedAt": "2025-11-12T06:30:16.123Z"
}
```

**Code Locations:**
- **Kafka Consumer:** `apps/alert/src/services/kafkaConsumerService.ts`
- **Kafka Producer:** `apps/alert/src/services/kafkaProducerService.ts`
- **Alert Manager:** `apps/alert/src/services/alertManagerService.ts`
- **Alert Helper:** `apps/alert/src/helpers/alertHelper.ts`
- **Aggregate Helper:** `apps/alert/src/helpers/aggregateHelper.ts`
- **PostgreSQL Service:** `apps/alert/src/services/postgresService.ts`
- **Redis Cache:** `apps/alert/src/services/redisCacheService.ts`

---

## 💰 Stage 5: Tariff Service
**Service:** `apps/tariff`  
**Purpose:** Consume regional aggregates, calculate dynamic tariffs based on load, publish tariff updates

#### Input: Kafka Messages
**Topic:** `aggregates_1m_regional`

**Sample Regional Aggregate:**
```json
{
  "region": "Mumbai-North",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "meter_count": 1523,
  "total_consumption": 252800,
  "avg_consumption": 5.18,
  "max_consumption": 18.5,
  "min_consumption": 0.2,
  "load_percentage": 79.0,
  "active_meters": ["MTR-001", "MTR-002", ...]
}
```

#### Tariff Calculation

**1. Consume Regional Aggregates**
- **File:** `apps/tariff/src/services/kafkaConsumerService.ts`
- **Consumer Group:** `tariff-group`
- **Topic:** `aggregates_1m_regional`

**2. Calculate Dynamic Tariff**
- **File:** `apps/tariff/src/helpers/aggregateHelper.ts`
- **Function:** `handleAggregate()`

**Pricing Algorithm:**
```typescript
// Load-based pricing tiers
if (load_percentage >= 90%) {
  // Critical Load: +20% surge pricing
  newPrice = basePrice * 1.20;
} else if (load_percentage >= 75%) {
  // High Load: +10% surge pricing
  newPrice = basePrice * 1.10;
} else if (load_percentage >= 50%) {
  // Normal Load: Base price
  newPrice = basePrice * 1.00;
} else {
  // Low Load: -5% discount
  newPrice = basePrice * 0.95;
}

// Only update if change > 2%
if (Math.abs(newPrice - lastPrice) / lastPrice > 0.02) {
  publishTariffUpdate(newPrice);
}
```

**Example Calculation:**
```
Region: Mumbai-North
Load: 79%
Base Price: ₹6.50/kWh
Tier: High Load (75-90%)
New Price: ₹6.50 * 1.10 = ₹7.15/kWh
Last Price: ₹6.50/kWh
Change: 10% (> 2% threshold)
Result: Publish tariff update
```

**3. Cache in Redis**
- **Key Pattern:** `tariff:{region}:current`
- **TTL:** No expiry (updated on change)
- **File:** `apps/tariff/src/services/redisCacheService.ts`

**4. Store in PostgreSQL**
```sql
INSERT INTO tariffs (
  tariff_id, region, time_of_day, price_per_kwh,
  effective_from, is_active, created_at
) VALUES (
  'TRF-MUM-NORTH-001', 'Mumbai-North', 'all_day', 7.15,
  '2025-11-12T06:30:00Z', true, NOW()
);

-- Deactivate old tariff
UPDATE tariffs 
SET is_active = false, effective_to = NOW()
WHERE region = 'Mumbai-North' AND is_active = true;
## 📡 Kafka Topics

### Topic: `telemetry-readings`
**Purpose:** Transport validated telemetry data from Ingestion to Stream Processor

**Configuration:**
- **Partitions:** 3 (configurable)
- **Replication Factor:** 1 (dev environment)
- **Retention:** 7 days

**Message Structure:**
- **Key:** `meterId` (string) - `"MTR-00000042"`
- **Value:** JSON (TelemetryReading + receivedAt)

**Sample Message:**
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "userId": "USR-00000021",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "energyKwh": 0.0435,
  "voltage": 235.6,
  "region": "Mumbai-North",
  "seq": 1523,
  "status": "OK",
  "metadata": {
    "mode": "normal",
    "baseLoad": 4.5
  },
  "receivedAt": "2025-11-12T06:30:01.234Z"
}
```

**Producer:**
- **Service:** Ingestion Service
- **File:** `apps/ingestion/src/services/kafkaProducer.ts`
- **Function:** `publishBatch()`

**Consumer:**
- **Service:** Stream Processor
- **File:** `apps/stream-processor/src/kafka/consumer.ts`
- **Consumer Group:** `stream-processor-group`

---

### Topic: `alerts`
**Purpose:** Transport anomaly alerts from Stream Processor to Alert Service

**Message Structure:**
- **Key:** `meter_id` (string)
- **Value:** JSON (Alert object)
- **Headers:** `{ type, severity, region }`

**Sample Message:**
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "type": "ANOMALY",
  "severity": "high",
  "meter_id": "MTR-00000042",
  "region": "Mumbai-North",
  "timestamp": "2025-11-12T06:30:15.000Z",
  "message": "Sudden power consumption spike: 150.0% increase (baseline: 5.00 kW, current: 12.50 kW)",
  "metadata": {
    "baseline": 5.0,
    "current": 12.5,
    "change": 150.0,
    "type": "spike"
  }
}
```

**Producer:**
- **Service:** Stream Processor
- **File:** `apps/stream-processor/src/kafka/producer.ts`
- **Function:** `publishAlert()`

**Consumer:**
- **Service:** Alert Service
- **File:** `apps/alert/src/services/kafkaConsumerService.ts`
- **Consumer Group:** `alert-group`

---

### Topic: `aggregates_1m`
**Purpose:** Transport per-meter 1-minute aggregates from Stream Processor

**Message Structure:**
- **Key:** `meterId` (string)
- **Value:** JSON (1-minute aggregate)
- **Headers:** `{ type: '1m_aggregate', region }`

**Sample Message:**
```json
{
  "meterId": "MTR-00000042",
  "region": "Mumbai-North",
  "windowStart": "2025-11-12T06:30:00.000Z",
  "avgPowerKw": 5.233,
  "maxPowerKw": 5.5,
  "energyKwhSum": 0.131,
  "count": 3
}
```

**Producer:**
- **Service:** Stream Processor
- **File:** `apps/stream-processor/src/kafka/producer.ts`
- **Function:** `publishAggregates1m()`

**Consumer:** None (future use: analytics, dashboards)

---

### Topic: `aggregates_15m`
**Purpose:** Transport per-meter 15-minute aggregates from Stream Processor

**Message Structure:**
- **Key:** `meterId` (string)
- **Value:** JSON (15-minute aggregate)
- **Headers:** `{ type: '15m_aggregate', region }`

**Producer:**
- **Service:** Stream Processor
- **File:** `apps/stream-processor/src/kafka/producer.ts`
- **Function:** `publishAggregates15m()`

**Consumer:** None (future use: billing, reporting)

---

### Topic: `aggregates_1m_regional`
**Purpose:** Transport regional 1-minute aggregates from Stream Processor to Alert & Tariff Services

**Message Structure:**
- **Key:** `region` (string)
- **Value:** JSON (regional aggregate)
- **Headers:** `{ type: 'regional_1m_aggregate', region }`

**Sample Message:**
```json
{
  "region": "Mumbai-North",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "meter_count": 1523,
  "total_consumption": 252800,
  "avg_consumption": 5.18,
  "max_consumption": 18.5,
  "min_consumption": 0.2,
  "load_percentage": 79.0,
  "active_meters": ["MTR-00000001", "MTR-00000002", ...]
}
```

**Producer:**
- **Service:** Stream Processor
- **File:** `apps/stream-processor/src/kafka/producer.ts`
- **Function:** `publishRegionalAggregates1m()`

**Consumers:**
1. **Alert Service** - Regional overload detection
   - **File:** `apps/alert/src/services/kafkaConsumerService.ts`
   - **Consumer Group:** `alert-group`
   
2. **Tariff Service** - Dynamic pricing calculation
   - **File:** `apps/tariff/src/services/kafkaConsumerService.ts`
   - **Consumer Group:** `tariff-group`

---

### Topic: `alerts_processed`
**Purpose:** Transport processed alerts from Alert Service to Notification Service

**Message Structure:**
- **Key:** `alertId` (string)
- **Value:** JSON (processed alert)

**Sample Message:**
```json
{
  "alertId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "type": "ANOMALY",
  "severity": "high",
  "meterId": "MTR-00000042",
  "region": "Mumbai-North",
  "message": "Sudden power consumption spike: 150.0% increase",
  "status": "active",
  "timestamp": "2025-11-12T06:30:15.000Z",
  "processedAt": "2025-11-12T06:30:16.123Z"
}
```

**Producer:**
- **Service:** Alert Service
- **File:** `apps/alert/src/services/kafkaProducerService.ts`
- **Function:** `publishProcessedAlert()`

**Consumer:**
- **Service:** Notification Service (TODO)

---

### Topic: `alert_status_updates`
**Purpose:** Transport alert status changes (acknowledged/resolved) from Alert Service

**Message Structure:**
- **Key:** `alertId` (string)
- **Value:** JSON (status update)

**Producer:**
- **Service:** Alert Service
- **File:** `apps/alert/src/services/kafkaProducerService.ts`

**Consumer:**
- **Service:** Notification Service (TODO)

---

### Topic: `tariff_updates`
**Purpose:** Transport tariff price changes from Tariff Service to Notification Service & API Gateway

**Message Structure:**
- **Key:** `region` (string)
- **Value:** JSON (tariff update)

**Sample Message:**
```json
{
  "tariffId": "TRF-MUM-NORTH-001",
  "region": "Mumbai-North",
  "pricePerKwh": 7.15,
  "previousPrice": 6.50,
  "changePercent": 10.0,
  "loadPercentage": 79.0,
  "effectiveFrom": "2025-11-12T06:30:00.000Z",
  "reason": "HIGH_LOAD",
  "timestamp": "2025-11-12T06:30:01.234Z"
}
```

**Producer:**
- **Service:** Tariff Service
- **File:** `apps/tariff/src/services/kafkaProducerService.ts`
- **Function:** `publishTariffUpdate()`

**Consumer:**
- **Service:** Notification Service (TODO)
- **Service:** API Gateway (WebSocket broadcast - TODO)
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    suspended_at TIMESTAMP,
    suspended_reason TEXT,
    last_login_at TIMESTAMP
);
```

**Sample Data:**
```
user_id                              | email              | name       | role | meter_id | region       | email_verified
-------------------------------------+--------------------+------------+------+----------+--------------+----------------
726fb1eb-df3d-4ee3-9c41-66fa48f6a4b5 | omargade@gmail.com | Om Argade  | user | M123456  | Mumbai-North | true
d0d8393f-93de-4f12-ad90-c83f8bc3b7bf | alertuser@test.com | Alert User | user | M999001  | Mumbai-North | true
```

#### 2. Alerts Table
```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    region VARCHAR(100),
    meter_id VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'acknowledged', 'resolved')),
    timestamp TIMESTAMPTZ NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Sample Data:**
```
id                                   | type             | severity | region       | meter_id           | message                                  | status
-------------------------------------+------------------+----------+--------------+--------------------+------------------------------------------+---------
c399c42d-6793-45cb-bc48-ff252ac01807 | high_consumption | high     | Mumbai-North | M999001            | Consumption is 30% higher than usual     | active
062e39fe-07d9-4c39-9c11-3087bd42f71b | offline_meter    | medium   | Mumbai-North | MTR-ALERT-TEST-001 | Meter offline for 2 hours                | resolved
```

#### 3. Tariffs Table
```sql
CREATE TABLE tariffs (
    tariff_id VARCHAR(50) PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    time_of_day VARCHAR(20),
    price_per_kwh DECIMAL(10, 4) NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Invoices Table
```sql
CREATE TABLE invoices (
    invoice_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id),
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    total_kwh DECIMAL(12, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(20) CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    due_date TIMESTAMP,
    paid_date TIMESTAMP,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Total Tables in PostgreSQL:** 8
- users
- meters
- tariffs
- alerts
- invoices
- invoice_line_items
- tariff_rules
- audit_logs

---

### TimescaleDB Database (segs_db on port 5433)

#### 1. Raw Readings (Hypertable)
**File:** `scripts/init-timescale.sql`

```sql
CREATE TABLE raw_readings (
    reading_id BIGSERIAL,
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    power_kw DECIMAL(12, 4),
    voltage DECIMAL(8, 2),
    current DECIMAL(8, 2),
    frequency DECIMAL(6, 2),
    power_factor DECIMAL(4, 2),
    temperature DECIMAL(6, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('raw_readings', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);
```

**Features:**
- **Hypertable:** Automatic time-based partitioning (1-day chunks)
- **Retention:** 7 days
- **Compression:** Data older than 1 day

#### 2. 1-Minute Aggregates (Hypertable)
```sql
CREATE TABLE aggregates_1m (
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    avg_power_kw DECIMAL(12, 4),
    max_power_kw DECIMAL(12, 4),
    min_power_kw DECIMAL(12, 4),
    energy_kwh_sum DECIMAL(12, 4),
    voltage_avg DECIMAL(8, 2),
    count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT aggregates_1m_pkey PRIMARY KEY (meter_id, window_start)
);

SELECT create_hypertable('aggregates_1m', 'window_start',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);
```

**Sample Data:**
```
meter_id     | region       | window_start        | avg_power_kw | max_power_kw | min_power_kw | count
-------------+--------------+---------------------+--------------+--------------+--------------+-------
MTR-00000010 | Mumbai-North | 2025-11-10 23:45:00 | 5.278667     | 5.672        | 4.823        | 3
MTR-00000014 | Mumbai-North | 2025-11-10 23:45:00 | 4.417000     | 4.876        | 3.958        | 3
```

**Features:**
- **Hypertable:** 1-day chunks
- **Retention:** 30 days
- **Compression:** Data older than 7 days
- **Unique Constraint:** (meter_id, window_start)

#### 3. 15-Minute Aggregates (Hypertable)
```sql
CREATE TABLE aggregates_15m (
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    avg_power_kw DECIMAL(12, 4),
    max_power_kw DECIMAL(12, 4),
    min_power_kw DECIMAL(12, 4),
    energy_kwh_sum DECIMAL(12, 4),
    voltage_avg DECIMAL(8, 2),
    count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT aggregates_15m_pkey PRIMARY KEY (meter_id, window_start)
);

SELECT create_hypertable('aggregates_15m', 'window_start',
## 📝 Who Does What

### Service Responsibilities

| Component | Responsibility | Tools/Libraries | File Path |
|-----------|---------------|-----------------|-----------|
| **Simulator** | Generate telemetry data | - | `apps/simulator/src/generator.ts` |
| **Ingestion - Validation** | Validate data structure | **Zod** | `apps/ingestion/src/schemas/zodSchemas.ts` |
| **Ingestion - Deduplication** | Detect duplicates | **Redis (SET NX)** | `apps/ingestion/src/services/redisDedupe.ts` |
| **Ingestion - Publishing** | Publish to Kafka | **KafkaJS** | `apps/ingestion/src/services/kafkaProducer.ts` |
| **Stream Processor - Consumption** | Consume from Kafka | **KafkaJS** | `apps/stream-processor/src/kafka/consumer.ts` |
| **Stream Processor - Anomaly Detection** | Detect power spikes/drops/outages | **Statistical baseline** | `apps/stream-processor/src/services/anomalyDetector.ts` |
| **Stream Processor - Alert Publishing** | Publish alerts to Kafka | **KafkaJS** | `apps/stream-processor/src/kafka/producer.ts` |
| **Stream Processor - Aggregation** | Aggregate readings (1m, 15m) | **In-Memory Maps** | `apps/stream-processor/src/services/aggregator.ts` |
| **Stream Processor - Regional Aggregation** | Compute regional consumption | **In-Memory Maps** | `apps/stream-processor/src/services/aggregator.ts` |
| **Stream Processor - Storage** | Store aggregates in TimescaleDB | **pg (node-postgres)** | `apps/stream-processor/src/db/timescale.ts` |
| **Stream Processor - Aggregate Publishing** | Publish aggregates to Kafka | **KafkaJS** | `apps/stream-processor/src/kafka/producer.ts` |
| **Alert Service - Alert Consumption** | Consume anomaly alerts | **KafkaJS** | `apps/alert/src/services/kafkaConsumerService.ts` |
| **Alert Service - Regional Consumption** | Consume regional aggregates | **KafkaJS** | `apps/alert/src/services/kafkaConsumerService.ts` |
| **Alert Service - Overload Detection** | Detect regional grid overload | **Threshold-based** | `apps/alert/src/helpers/aggregateHelper.ts` |
| **Alert Service - Deduplication** | Prevent duplicate alerts | **Redis (TTL keys)** | `apps/alert/src/services/alertManagerService.ts` |
| **Alert Service - Storage** | Store alerts in PostgreSQL | **pg** | `apps/alert/src/services/postgresService.ts` |
| **Alert Service - Publishing** | Publish processed alerts | **KafkaJS** | `apps/alert/src/services/kafkaProducerService.ts` |
| **Tariff Service - Regional Consumption** | Consume regional aggregates | **KafkaJS** | `apps/tariff/src/services/kafkaConsumerService.ts` |
| **Tariff Service - Price Calculation** | Calculate dynamic tariffs | **Load-based algorithm** | `apps/tariff/src/services/tariffCalculatorService.ts` |
| **Tariff Service - Caching** | Cache current tariffs | **Redis** | `apps/tariff/src/services/redisCacheService.ts` |
| **Tariff Service - Storage** | Store tariffs in PostgreSQL | **pg** | `apps/tariff/src/services/postgresService.ts` |
| **Tariff Service - Publishing** | Publish tariff updates | **KafkaJS** | `apps/tariff/src/services/kafkaProducerService.ts` |

## 📡 Kafka Topics

### Topic: `telemetry-readings`
**Purpose:** Transport validated telemetry data from Ingestion to Stream Processor

**Configuration:**
- **Partitions:** 3 (configurable)
- **Replication Factor:** 1 (dev environment)
- **Retention:** 7 days

**Message Structure:**

**Key:** `meterId` (string)
```
"MTR-00000042"
```

**Value:** JSON (TelemetryReading + receivedAt)
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "userId": "USR-00000021",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "energyKwh": 0.0435,
  "voltage": 235.6,
  "region": "Mumbai-North",
  "seq": 1523,
  "status": "OK",
  "metadata": {
    "mode": "normal",
    "baseLoad": 4.5
  },
  "receivedAt": "2025-11-12T06:30:01.234Z"
}
```

**Producer:**
- **Service:** Ingestion Service
- **File:** `apps/ingestion/src/services/kafkaProducer.ts`
- **Function:** `publishBatch()`

**Consumer:**
- **Service:** Stream Processor
- **File:** `apps/stream-processor/src/kafka/consumer.ts`
- **Consumer Group:** `stream-processor-group`
- **Function:** `handleMessage()`

---

## 🔄 Complete Data Transformation Summary

### Stage 1: Simulator → Ingestion
**No transformation** - Data sent as-is via HTTP POST

**Original:**
```json
{
  "readingId": "uuid",
  "meterId": "MTR-00000042",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "voltage": 235.6,
  "region": "Mumbai-North"
}
```

**After HTTP POST:** Same (no change)

### Stage 2: Ingestion Validation
**Validation by:** Zod (`apps/ingestion/src/schemas/zodSchemas.ts`)

**Checks:**
- ✅ All required fields present
- ✅ Timestamp is valid ISO 8601
- ✅ Numbers are positive
- ✅ Batch size 1-1000

**If validation fails:** HTTP 400 with error details
**If validation passes:** Proceed to deduplication

### Stage 3: Ingestion Deduplication
**Deduplication by:** Redis (`apps/ingestion/src/services/redisDedupe.ts`)

**Process:**
1. Create key: `reading:{meterId}:{timestamp}`
2. Try Redis SET NX (set if not exists)
3. If success → unique
4. If fail → duplicate

**Result:**
- Unique readings → Sent to Kafka
- Duplicate readings → Counted, not sent to Kafka

### Stage 4: Ingestion → Kafka
**Transformation:** Add `receivedAt` timestamp

**Before:**
```json
{
  "readingId": "uuid",
  "meterId": "MTR-00000042",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234
}
```

**After (published to Kafka):**
```json
{
  "readingId": "uuid",
  "meterId": "MTR-00000042",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "receivedAt": "2025-11-12T06:30:01.234Z"  ← ADDED
}
```

**Location:** `apps/ingestion/src/services/kafkaProducer.ts`

### Stage 5: Kafka → Stream Processor
**No transformation** - Data consumed as-is

**Consumed:**
```json
{
  "readingId": "uuid",
  "meterId": "MTR-00000042",
  "timestamp": "2025-11-12T06:30:00.000Z",
  "powerKw": 5.234,
  "receivedAt": "2025-11-12T06:30:01.234Z"
}
```

### Stage 6: Stream Processor Aggregation
**Transformation:** Multiple readings → Aggregate statistics

**Input (3 readings):**
```json
[
  { "meterId": "MTR-42", "powerKw": 5.2, "voltage": 235.6, "timestamp": "06:30:10" },
  { "meterId": "MTR-42", "powerKw": 5.5, "voltage": 238.1, "timestamp": "06:30:30" },
  { "meterId": "MTR-42", "powerKw": 5.0, "voltage": 236.8, "timestamp": "06:30:50" }
]
```

**Output (1 aggregate):**
```json
{
  "meterId": "MTR-00000042",
  "region": "Mumbai-North",
  "windowStart": "2025-11-12T06:30:00.000Z",
  "avgPowerKw": 5.233,
  "maxPowerKw": 5.5,
  "minPowerKw": 5.0,
  "energyKwhSum": 0.131,
  "voltageAvg": 236.833,
  "count": 3
}
```

**Location:** `apps/stream-processor/src/services/aggregator.ts`

### Stage 7: Stream Processor → TimescaleDB
**Transformation:** JSON → SQL INSERT

**SQL Statement:**
```sql
INSERT INTO aggregates_1m (
  meter_id, region, window_start,
  avg_power_kw, max_power_kw, min_power_kw,
  energy_kwh_sum, voltage_avg, count
) VALUES (
  'MTR-00000042', 'Mumbai-North', '2025-11-12 06:30:00+00',
  5.233, 5.5, 5.0,
  0.131, 236.833, 3
)
ON CONFLICT (meter_id, window_start)
DO UPDATE SET
  avg_power_kw = EXCLUDED.avg_power_kw,
  ...
```

**Location:** `apps/stream-processor/src/db/timescale.ts`

---

## 📝 Who Does What

### Service Responsibilities

| Component | Responsibility | Tools/Libraries | File Path |
|-----------|---------------|-----------------|-----------|
## 📚 File Reference

### Core Data Flow Files

| Purpose | File Path |
|---------|-----------|
| **Simulator - Data Generation** | `apps/simulator/src/generator.ts` |
| **Simulator - Types** | `apps/simulator/src/types.ts` |
| **Ingestion - Validation Schema** | `apps/ingestion/src/schemas/zodSchemas.ts` |
| **Ingestion - Deduplication** | `apps/ingestion/src/services/redisDedupe.ts` |
| **Ingestion - Kafka Producer** | `apps/ingestion/src/services/kafkaProducer.ts` |
| **Ingestion - Controller** | `apps/ingestion/src/controllers/telemetry/telemetryOperationalController.ts` |
| **Stream - Kafka Consumer** | `apps/stream-processor/src/kafka/consumer.ts` |
| **Stream - Kafka Producer** | `apps/stream-processor/src/kafka/producer.ts` |
| **Stream - Anomaly Detector** | `apps/stream-processor/src/services/anomalyDetector.ts` |
| **Stream - Aggregator** | `apps/stream-processor/src/services/aggregator.ts` |
| **Stream - Flush Controller** | `apps/stream-processor/src/controllers/flushController.ts` |
| **Stream - TimescaleDB Writer** | `apps/stream-processor/src/db/timescale.ts` |
| **Stream - Processors Helper** | `apps/stream-processor/src/helpers/processorsHelper.ts` |
| **Alert - Kafka Consumer** | `apps/alert/src/services/kafkaConsumerService.ts` |
| **Alert - Kafka Producer** | `apps/alert/src/services/kafkaProducerService.ts` |
| **Alert - Alert Manager** | `apps/alert/src/services/alertManagerService.ts` |
| **Alert - Alert Helper** | `apps/alert/src/helpers/alertHelper.ts` |
| **Alert - Aggregate Helper** | `apps/alert/src/helpers/aggregateHelper.ts` |
| **Alert - PostgreSQL Service** | `apps/alert/src/services/postgresService.ts` |
| **Alert - Redis Cache** | `apps/alert/src/services/redisCacheService.ts` |
| **Tariff - Kafka Consumer** | `apps/tariff/src/services/kafkaConsumerService.ts` |
| **Tariff - Kafka Producer** | `apps/tariff/src/services/kafkaProducerService.ts` |
| **Tariff - Tariff Calculator** | `apps/tariff/src/services/tariffCalculatorService.ts` |
| **Tariff - Aggregate Helper** | `apps/tariff/src/helpers/aggregateHelper.ts` |
| **Tariff - PostgreSQL Service** | `apps/tariff/src/services/postgresService.ts` |
| **Tariff - Redis Cache** | `apps/tariff/src/services/redisCacheService.ts` |
| **PostgreSQL Schema** | `scripts/init-db.sql` |
| **TimescaleDB Schema** | `scripts/init-timescale.sql` |ty
timestamp: z.string().datetime()       // Must be ISO 8601 format
powerKw: z.number().min(0)             // Must be >= 0

// Optional Fields
voltage: z.number().min(0).optional()        // If present, must be >= 0
current: z.number().min(0).optional()        // If present, must be >= 0
frequency: z.number().min(0).optional()      // If present, must be >= 0
powerFactor: z.number().min(0).max(1).optional()  // If present, 0-1
temperature: z.number().optional()           // If present, any number

// Batch Constraints
z.array(readingSchema).min(1).max(1000)  // 1-1000 readings per batch
```

### Deduplication Logic (Redis)

**File:** `apps/ingestion/src/services/redisDedupe.ts`

```typescript
// Key Format
generateKey(meterId, timestamp): string {
  return `reading:${meterId}:${timestamp}`;
}

// Example
meterId = "MTR-00000042"
timestamp = "2025-11-12T06:30:00.000Z"
key = "reading:MTR-00000042:2025-11-12T06:30:00.000Z"

// Check and Mark
async checkAndMark(meterId, timestamp): Promise<boolean> {
  const key = this.generateKey(meterId, timestamp);
  const result = await redis.set(key, '1', {
    NX: true,    // Only set if key doesn't exist
    EX: 60       // Expire after 60 seconds
  });
  return result !== null;  // true = unique, false = duplicate
}
```

**Process Flow:**
1. Reading arrives with meterId + timestamp
2. Generate Redis key
3. Try to SET with NX flag
4. If SET succeeds → First time seeing this reading → **UNIQUE**
5. If SET fails → Already seen this reading → **DUPLICATE**
6. Key expires after 60 seconds (TTL)

---

## 📊 Sample Data Flow Example

### Complete Journey of One Reading

**1. Generated by Simulator**
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "userId": "USR-00000021",
  "timestamp": "2025-11-12T06:30:15.000Z",
  "powerKw": 5.234,
  "energyKwh": 0.0435,
  "voltage": 235.6,
  "region": "Mumbai-North",
  "seq": 1523,
  "status": "OK",
  "metadata": { "mode": "normal", "baseLoad": 4.5 }
}
```

**2. Sent to Ingestion Service**
HTTP POST to `http://localhost:3001/telemetry/batch`
```json
[
  {
    "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
    "meterId": "MTR-00000042",
    "region": "Mumbai-North",
    "timestamp": "2025-11-12T06:30:15.000Z",
    "powerKw": 5.234,
    "voltage": 235.6
  }
]
```

**3. Validated by Zod**
✅ All required fields present  
✅ Timestamp is valid ISO 8601  
✅ powerKw is positive number  
✅ Batch size is 1 (within 1-1000 range)

**4. Checked for Duplicates (Redis)**
```
Redis Key: "reading:MTR-00000042:2025-11-12T06:30:15.000Z"
Redis SET NX: Success (first time)
Result: UNIQUE ✅
```

**5. Published to Kafka**
```json
{
  "readingId": "a3f5e7b9-1234-5678-90ab-cdef12345678",
  "meterId": "MTR-00000042",
  "region": "Mumbai-North",
  "timestamp": "2025-11-12T06:30:15.000Z",
  "powerKw": 5.234,
  "voltage": 235.6,
  "receivedAt": "2025-11-12T06:30:16.123Z"  ← Added by Ingestion
}
```

**Kafka Details:**
- Topic: `telemetry-readings`
- Key: `MTR-00000042`
- Partition: 2 (based on hash of meterId)

**6. Consumed by Stream Processor**
Message received from Kafka topic `telemetry-readings`, partition 2

**7. Aggregated In-Memory**
```
1-minute bucket: "2025-11-12T06:30:00.000Z"
15-minute bucket: "2025-11-12T06:30:00.000Z"

Window for MTR-00000042 @ 06:30:00:
  powerSum += 5.234
  maxPower = max(previous, 5.234)
  minPower = min(previous, 5.234)
  energySum += 0.0435
  voltageSum += 235.6
  voltageCount += 1
  count += 1
```

**8. Flushed to TimescaleDB** (after 1 minute)
```sql
INSERT INTO aggregates_1m (
  meter_id, region, window_start,
  avg_power_kw, max_power_kw, min_power_kw,
  energy_kwh_sum, voltage_avg, count
) VALUES (
  'MTR-00000042',
  'Mumbai-North',
  '2025-11-12 06:30:00+00',
  5.233,    -- Average of all readings in this minute
  5.5,      -- Maximum power reading
  5.0,      -- Minimum power reading
  0.131,    -- Sum of energy
  236.833,  -- Average voltage
  3         -- Total readings in this window
)
ON CONFLICT (meter_id, window_start)
DO UPDATE SET ...
```

**9. Stored in TimescaleDB**
```
Table: aggregates_1m
Chunk: 2025-11-12 (1-day chunk)
Compression: Applied after 7 days
Retention: Deleted after 30 days
```

---

## 🔍 Key Insights

### Data Size Comparison

**Single Reading (Simulator → Ingestion):**
- Size: ~450 bytes (JSON)
- Frequency: Every few seconds per meter
- Volume: 1000 meters × 60 readings/hour = 60,000 readings/hour

**Single Aggregate (Stream Processor → TimescaleDB):**
- Size: ~200 bytes (row)
- Frequency: Once per minute per meter
- Volume: 1000 meters × 60 aggregates/hour = 60,000 rows/hour

**Storage Savings:**
- Raw readings: Retained for 7 days, then deleted
- 1-min aggregates: Retained for 30 days
- 15-min aggregates: Retained for 365 days
- Total storage: ~95% reduction vs. storing all raw data

### Latency Breakdown

## ✅ Conclusion

This system processes telemetry data through a robust multi-stage pipeline:

### Data Flow Summary

1. **Simulator** generates realistic meter readings with power consumption patterns
2. **Ingestion Service** validates with **Zod**, deduplicates with **Redis**, adds `receivedAt` timestamp, publishes to **Kafka**
3. **Stream Processor** consumes telemetry, performs:
   - **Anomaly detection** (spikes, drops, outages)
   - **In-memory aggregation** (1m, 15m windows)
   - **Regional aggregation** (per-region consumption stats)
   - **Publishing** to multiple Kafka topics (alerts, aggregates, regional data)
   - **Storage** to TimescaleDB hypertables
4. **Alert Service** consumes:
   - **Anomaly alerts** from Stream Processor
   - **Regional aggregates** for overload detection
   - Deduplicates, stores in PostgreSQL, publishes processed alerts
5. **Tariff Service** consumes regional aggregates, calculates dynamic pricing based on load, publishes tariff updates

### Kafka Topics Overview

| Topic | Producer | Consumer(s) | Purpose |
|-------|----------|-------------|---------|
| `telemetry-readings` | Ingestion | Stream Processor | Raw telemetry data |
| `alerts` | Stream Processor | Alert Service | Anomaly alerts |
| `aggregates_1m` | Stream Processor | - | Per-meter 1-minute aggregates |
| `aggregates_15m` | Stream Processor | - | Per-meter 15-minute aggregates |
| `aggregates_1m_regional` | Stream Processor | Alert, Tariff | Regional consumption stats |
| `alerts_processed` | Alert Service | Notification (TODO) | Processed alerts |
| `alert_status_updates` | Alert Service | Notification (TODO) | Alert status changes |
| `tariff_updates` | Tariff Service | Notification, API Gateway (TODO) | Price changes |

### Key Technologies

- **Validation:** Zod (schema-based validation)
- **Deduplication:** Redis (SET NX with TTL)
- **Messaging:** Kafka/KafkaJS (8 topics)
- **Anomaly Detection:** Statistical baseline with dynamic thresholds
- **Aggregation:** In-memory Maps with time-window bucketing
- **Storage:** PostgreSQL (transactional data), TimescaleDB (time-series data)
- **Caching:** Redis (tariffs, alert deduplication)

### Data Transformations

| Stage | Transformation | Tool/Method |
|-------|---------------|-------------|
| Simulator → Ingestion | None (raw data) | HTTP POST |
| Ingestion → Kafka | Add `receivedAt` timestamp | JavaScript |
| Stream Processor | Detect anomalies | Statistical baseline |
| Stream Processor | Aggregate readings | In-memory windowing |
| Stream Processor | Compute regional stats | Group by region |
| Alert Service | Deduplicate alerts | Redis TTL keys |
| Tariff Service | Calculate dynamic price | Load-based algorithm |

### Next Steps (Not Yet Implemented)

- **Notification Service:** Consume `alerts_processed` and `tariff_updates`, send emails/SMS/push notifications
- **API Gateway:** WebSocket integration for real-time tariff updates, alert subscriptions

---

**Document Version:** 2.0  
**Last Updated:** November 12, 2025  
**Maintained By:** Smart Energy Grid System Team-processor/src/db/timescale.ts` |
| **PostgreSQL Schema** | `scripts/init-db.sql` |
| **TimescaleDB Schema** | `scripts/init-timescale.sql` |

---

## ✅ Conclusion

This system processes telemetry data through a robust pipeline:

1. **Simulator** generates realistic meter readings
2. **Ingestion** validates with **Zod**, deduplicates with **Redis**, publishes to **Kafka**
3. **Stream Processor** aggregates in-memory, flushes to **TimescaleDB**
4. **TimescaleDB** stores compressed, time-partitioned data with automatic retention

**Key Technologies:**
- **Validation:** Zod
- **Deduplication:** Redis (SET NX with TTL)
- **Messaging:** Kafka (topic: telemetry-readings)
- **Aggregation:** In-memory Maps with time-window bucketing
- **Storage:** TimescaleDB (hypertables with compression & retention)

**Data Transformations:**
- Simulator → Ingestion: None
- Ingestion → Kafka: Add `receivedAt` timestamp
- Kafka → Stream Processor: None
- Stream Processor → TimescaleDB: Aggregate multiple readings into statistics

---

**Document Version:** 1.0  
**Last Updated:** November 12, 2025  
**Maintained By:** Smart Energy Grid System Team
