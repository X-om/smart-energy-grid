# Smart Energy Grid System - Project Notes

## Current Status (November 12, 2025)

### ✅ Completed & Operational

#### API Testing Progress: 42/85 endpoints (62.4%)
- ✅ **Authentication** (10/10): Full auth flow with JWT, OTP, password management
- ✅ **User Management** (4/4): Profile CRUD, notification preferences
- ✅ **Telemetry User** (5/5): My readings, history, stats, breakdowns
- ✅ **Telemetry Operator** (5/5): Meter queries, regional stats, top consumers
- ✅ **Tariff User** (5/5): Current tariff, history, estimates, forecasts
- ✅ **Tariff Operator** (2/2): All regions, analytics
- ✅ **Tariff Admin** (2/2): Override tariff, remove override
- ✅ **Alert User** (2/2): My alerts with pagination, alert details
- ✅ **Alert Operator** (7/7): All alerts, active, history, stats, acknowledge, resolve

#### Automated Pipeline Status: ✅ FULLY OPERATIONAL
```
Simulator (100 meters, 5s interval)
  ↓ Kafka: raw_readings
Ingestion Service
  ↓ PostgreSQL: raw_readings hypertable
  ↓ Kafka: raw_readings (passthrough)
Stream Processor
  ↓ Kafka: aggregates_1m, aggregates_1m_regional, alerts
  ↓ TimescaleDB: aggregates_1m, aggregates_15m hypertables
Alert Service
  ↓ PostgreSQL: alerts table (5 created, 1 resolved)
  ↓ Kafka: alerts_processed
Tariff Service
  ↓ PostgreSQL: tariffs table (4 regions with dynamic pricing)
  ↓ Kafka: tariff_updates
Notification Service
  ↓ WebSocket: Real-time broadcasts to subscribed clients
```

### ⏭️ Next Testing Phases

#### 1. Invoice Routes (12 endpoints) - Priority: HIGH
**User Routes (8):**
- GET `/api/v1/invoices/` - Get user invoices (paginated)
- GET `/api/v1/invoices/:invoiceId` - Get invoice details
- GET `/api/v1/invoices/:invoiceId/download` - Download invoice PDF
- GET `/api/v1/invoices/current-cycle` - Current billing cycle
- GET `/api/v1/invoices/estimated` - Estimated bill
- GET `/api/v1/invoices/payment-history` - Payment history
- PUT `/api/v1/invoices/:invoiceId/paid` - Mark invoice as paid
- POST `/api/v1/invoices/:invoiceId/dispute` - Dispute invoice

**Operator Routes (4):**
- GET `/api/v1/invoices/operator/overdue/:region` - Overdue invoices by region
- GET `/api/v1/invoices/operator/analytics` - Invoice analytics
- POST `/api/v1/invoices/operator/generate-monthly` - Generate monthly invoices
- GET `/api/v1/invoices/operator/export` - Export invoice data

**Prerequisites:**
- Check `ENABLE_BILLING` feature flag in API Gateway `.env`
- Verify `invoices` table schema matches code expectations
- Ensure invoice generation logic is implemented

#### 2. Enhanced Operator Routes (10 endpoints) - Priority: MEDIUM
- User management endpoints (details, list, export)
- Meter management endpoints (list, details, status updates)
- Dashboard statistics and reports
- Revenue and consumption analytics

#### 3. Enhanced Admin Routes (15 endpoints) - Priority: MEDIUM
- User administration (suspend, activate)
- Meter CRUD operations (create, update, delete, unassign)
- System health monitoring
- Audit logs
- Configuration updates
- Data seeding utilities

#### 4. Notification & System Routes (6 endpoints) - Priority: LOW
- WebSocket connection testing
- Health checks
- Metrics endpoints
- System status monitoring

---

## 🐛 Issues Fixed This Session (Issues #8-11)

### Issue #8: Alert Service - Hardcoded Kafka Topic Names
**Root Cause:** `apps/alert/src/lifecycle/processLifecycle.ts` used hardcoded topic names instead of Config values
```typescript
// ❌ Before
if (topic === 'aggregated-data') {  // Wrong hardcoded name
} else if (topic === 'anomaly-detected') {  // Wrong hardcoded name

// ✅ After
if (topic === Config.kafka.topicAggregates) {  // 'aggregates_1m_regional'
} else if (topic === Config.kafka.topicAlerts) {  // 'alerts'
```
**Impact:** Alert service appeared healthy (0 lag) but wasn't consuming messages
**Fix:** Changed to use Config references
**Validation:** Consumer group shows 0 lag, messages processed

### Issue #9: Alert Service - Case Sensitivity in Alert Type Check
**Root Cause:** Stream processor sends uppercase "ANOMALY", code checked lowercase "anomaly"
```typescript
// ❌ Before
if (alertData.type === 'anomaly') {  // Lowercase check

// ✅ After
if (alertData.type.toUpperCase() === 'ANOMALY') {  // Case-insensitive
```
**Impact:** Messages consumed but alerts not saved to database (silent failure)
**Fix:** Added `.toUpperCase()` for case-insensitive comparison
**Validation:** 5 alerts successfully created in database

### Issue #10: Alert Service - Database Column Name Mismatches
**Root Cause:** Code used different column names than actual database schema
```
Code Expected     | Database Has
------------------|------------------
type              | alert_type
id                | alert_id
status            | is_resolved (boolean)
timestamp         | created_at
```
**Impact:** Database INSERT/UPDATE operations failed with "column does not exist" errors
**Fix:** 10 sequential edits in `apps/alert/src/services/postgresService.ts`:
- Updated all queries to use correct column names
- Added `mapRowToAlert()` function to transform database format to API interface
**Validation:** Alerts successfully created, retrieved, and updated

### Issue #11: Alert Service - Status Column Mapping
**Root Cause:** Status update logic tried to update non-existent `status` column
```typescript
// ❌ Before
if (data.status !== undefined) {
  updates.push(`status = $${paramIndex++}`);
  values.push(data.status);
}

// ✅ After
if (data.status !== undefined) {
  if (data.status === 'resolved') {
    updates.push(`is_resolved = $${paramIndex++}`);
    values.push(true);
  } else if (data.status === 'active') {
    updates.push(`is_resolved = $${paramIndex++}`);
    values.push(false);
  }
}
```
**Impact:** Acknowledge worked but resolve failed
**Fix:** Map status enum values to `is_resolved` boolean
**Validation:** Both acknowledge and resolve operations successful with full audit trail

---

## 📋 Known Technical Debt

### 1. Stream Processor - Missing Calculations (Priority: HIGH)
**Issue:** Fields not being calculated/populated in aggregates
```sql
-- Currently returning 0 or NULL:
min_power_kw        -- Minimum power reading
voltage_avg         -- Average voltage
current_avg         -- Average current
```

**Files to Fix:**
- `apps/stream-processor/src/services/aggregator.ts` - Add calculation logic
- `apps/stream-processor/src/db/timescale.ts` - Ensure fields included in INSERT

**Impact:** Data quality issue, affects analytics accuracy

**Fix Plan:**
1. Review aggregator logic for 1-minute and 15-minute windows
2. Add min tracking (currently only tracks max and avg)
3. Add voltage and current averaging from raw readings
4. Test with live data flow

### 2. Energy Consumption Column (Priority: MEDIUM)
**Status:** Column added to schema, pending service restart
```sql
ALTER TABLE raw_readings ADD COLUMN energy_kwh DECIMAL(12, 6);
```

**Next Steps:**
1. Restart ingestion service to populate new column
2. Verify simulator includes energy_kwh in telemetry data
3. Update stream processor to aggregate energy_kwh
4. Test consumption calculations in API responses

---

## 🔌 WebSocket Notification Architecture

### Current Implementation: ✅ DIRECT CONNECTION TO NOTIFICATION SERVICE

**Architecture Overview:**
```
Client Device (Web/Mobile App)
  ↓ WebSocket Connection
  ws://notification-service:3003/ws?token=<JWT>
  ↓
Notification Service (Port 3003)
  ↓ Kafka Consumer
  - alerts_processed
  - alert_status_updates  
  - tariff_updates
  ↓ WebSocket Broadcast
Subscribed Clients (filtered by channels)
```

### Connection Flow:

#### 1. User Authentication
```
User logs in via API Gateway
  → Receives JWT token with claims:
    - userId
    - role (user/operator/admin)
    - region (user's region)
    - meterId (user's meter ID)
```

#### 2. WebSocket Connection
```javascript
// Client connects DIRECTLY to notification service
const ws = new WebSocket('ws://localhost:3003/ws?token=YOUR_JWT_TOKEN');

// Or with Authorization header
const ws = new WebSocket('ws://localhost:3003/ws');
ws.setRequestHeader('Authorization', 'Bearer YOUR_JWT_TOKEN');
```

#### 3. Authentication & Auto-Subscribe
```
Notification service validates JWT
  → Extracts user info (userId, role, region, meterId)
  → Auto-subscribes to default channels based on role:

USER role:
  ✓ tariffs                    (all tariff updates)
  ✓ region:{user.region}       (regional alerts/updates)
  ✓ meter:{user.meterId}       (meter-specific alerts)

OPERATOR role:
  ✓ alerts                     (all new alerts)
  ✓ tariffs                    (all tariff updates)
  ✓ alert_status_updates       (acknowledgments, resolutions)
  ✓ region:{user.region}       (if region assigned)

ADMIN role:
  ✓ ALL channels (unrestricted access)
```

#### 4. Welcome Message
```json
{
  "type": "WELCOME",
  "payload": {
    "clientId": "uuid-v4",
    "userId": "93d38c1f-7b17-419e-9536-772392d23664",
    "role": "user",
    "channels": ["tariffs", "region:Pune-West", "meter:MTR-00000044"],
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
}
```

### Channel-Based Broadcasting:

#### Alert Notifications (from alert service)
```json
{
  "type": "ALERT",
  "payload": {
    "alert_id": "uuid",
    "alert_type": "ANOMALY",
    "severity": "medium",
    "meter_id": "MTR-00000044",
    "region": "Pune-West",
    "message": "Power spike detected: 101.9% increase",
    "metadata": {
      "baseline_power_kw": 4.532,
      "current_power_kw": 9.150,
      "change_percent": 101.9
    },
    "created_at": "2025-11-12T10:15:00.000Z"
  }
}
```
**Broadcast to:**
- `alerts` channel → All operators/admins
- `region:Pune-West` → Users/operators in Pune-West
- `meter:MTR-00000044` → User assigned to that meter

#### Tariff Updates (from tariff service)
```json
{
  "type": "TARIFF_UPDATE",
  "payload": {
    "region": "Pune-West",
    "rate_per_kwh": 6.75,
    "regional_load_factor": 0.85,
    "updated_at": "2025-11-12T10:00:00.000Z"
  }
}
```
**Broadcast to:**
- `tariffs` channel → All users (everyone sees tariff updates)
- `region:Pune-West` → Users in that region

#### Alert Status Updates (from alert service)
```json
{
  "type": "ALERT_STATUS_UPDATE",
  "payload": {
    "alert_id": "uuid",
    "previous_status": "active",
    "new_status": "resolved",
    "acknowledged": true,
    "acknowledged_by": "operator-user-id",
    "resolution_note": "Grid stabilized",
    "updated_at": "2025-11-12T10:20:00.000Z",
    "metadata": {
      "region": "Pune-West"
    }
  }
}
```
**Broadcast to:**
- `alert_status_updates` channel → All operators/admins
- `alerts` channel → All operators/admins
- `region:Pune-West` → Users/operators in that region

### Dynamic Channel Subscription:

Clients can subscribe/unsubscribe from additional channels:

```javascript
// Subscribe to additional channels
ws.send(JSON.stringify({
  action: 'subscribe',
  channels: ['region:Mumbai-North', 'meter:MTR-00000050']
}));

// Response
{
  "type": "SUBSCRIBED",
  "payload": {
    "channels": ["region:Mumbai-North", "meter:MTR-00000050"]
  }
}

// Unsubscribe from channels
ws.send(JSON.stringify({
  action: 'unsubscribe',
  channels: ['region:Mumbai-North']
}));

// Response
{
  "type": "UNSUBSCRIBED",
  "payload": {
    "channels": ["region:Mumbai-North"]
  }
}
```

**Access Control:** Notification service validates channel access based on user role:
- Users can only access their own region/meter channels + public tariffs
- Operators can access alerts, alert_status_updates, all regions
- Admins have unrestricted access

### Heartbeat & Connection Management:

```
Client ←→ Notification Service
  ↓
Ping every 30 seconds (default)
  ↓
Pong response required
  ↓
No pong → Connection terminated
```

### Database Preference Integration:

User preferences stored in PostgreSQL `user_preferences` table:
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(user_id),
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  websocket_notifications BOOLEAN DEFAULT TRUE,  -- ← Controls WebSocket
  alert_severity_threshold VARCHAR(20) DEFAULT 'low'
);
```

**Note:** `websocket_notifications` preference exists but is NOT currently enforced by notification service. All authenticated users with valid JWT can connect. Future enhancement could add preference-based filtering.

---

## 🚀 Deployment Architecture

### Services & Ports:
```
API Gateway:         http://localhost:3000
Ingestion:           http://localhost:3001  
Stream Processor:    http://localhost:3002
Notification:        http://localhost:3003  (HTTP + WebSocket)
Alert:               http://localhost:3004
Tariff:              http://localhost:3005
Simulator:           http://localhost:3010

WebSocket Endpoint:  ws://localhost:3003/ws?token=<JWT>
```

### Infrastructure:
```
PostgreSQL:          localhost:5432 (segs_db)
TimescaleDB:         localhost:5432 (segs_db - with TimescaleDB extension)
Redis:               localhost:6379
Kafka:               localhost:9092
Zookeeper:           localhost:2181
```

### Data Flow:
```
1. Simulator generates telemetry → Kafka (raw_readings)
2. Ingestion consumes → Stores in TimescaleDB → Re-publishes to Kafka
3. Stream Processor consumes → Aggregates → Kafka (aggregates_1m, aggregates_1m_regional, alerts)
4. Alert Service consumes alerts → Stores in PostgreSQL → Kafka (alerts_processed)
5. Tariff Service consumes aggregates → Calculates pricing → Stores in PostgreSQL → Kafka (tariff_updates)
6. Notification Service consumes (alerts_processed, alert_status_updates, tariff_updates) → WebSocket broadcast
7. API Gateway provides REST endpoints for all CRUD operations
```

---

## 📝 Testing Methodology

### Pattern Observed:
1. **Test endpoint** via REST client (Postman/similar)
2. **Discover issue** (4xx/5xx error or incorrect data)
3. **Root cause analysis** (logs, database queries, Kafka inspection)
4. **Fix code** (TypeScript edits, config updates)
5. **Rebuild service** (`pnpm build`)
6. **Restart service** (kill port + `pnpm start`)
7. **Retest endpoint** (verify 200 OK with correct data)
8. **Document** in API_TEST_RESULTS.md

### Key Learnings:
- **Silent failures are common:** Services can appear healthy (running, 0 errors) but produce no output
- **Integration bugs > Logic bugs:** Most issues from service-to-service communication
- **Column name mismatches:** Code and database schema must use identical names
- **Case sensitivity matters:** Uppercase/lowercase mismatches broke multiple features
- **Kafka topic names:** Hardcoded strings diverge from actual configuration over time
- **Manual testing essential:** Unit tests alone don't catch integration issues

### Success Criteria:
- ✅ 200 OK HTTP status
- ✅ Valid JSON response matching expected schema
- ✅ Database reflects changes (for write operations)
- ✅ Kafka messages produced (for async operations)
- ✅ WebSocket broadcasts sent (for notification-enabled operations)

---

## 🔐 Security & Authentication

### JWT Token Structure:
```json
{
  "userId": "uuid",
  "username": "string",
  "email": "string",
  "role": "user|operator|admin",  // lowercase in token
  "region": "string|null",
  "meterId": "string|null",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Important:** Roles are stored UPPERCASE in database but normalized to lowercase in JWT (Issue #6 fix)

### Role-Based Access Control (RBAC):
```
USER:
  ✓ Own profile, telemetry, tariffs, invoices, alerts
  ✗ Other users' data
  ✗ System administration

OPERATOR:
  ✓ All USER permissions
  ✓ Regional telemetry, alerts, tariffs
  ✓ Acknowledge/resolve alerts
  ✓ View all meters in assigned region
  ✗ Modify tariffs (read-only)
  ✗ System administration

ADMIN:
  ✓ All OPERATOR permissions
  ✓ Modify tariffs (override, remove override)
  ✓ User management (suspend, activate, role changes)
  ✓ Meter CRUD operations
  ✓ System configuration
  ✓ Audit logs
```

### Authentication Middleware:
- `authenticate` - Validates JWT, extracts user info
- `requireRole(['operator', 'admin'])` - Enforces role requirements
- Token refresh mechanism with separate refresh tokens
- Session management with Redis

---

## 📊 Monitoring & Observability

### Health Checks:
```bash
# API Gateway
curl http://localhost:3000/health

# Each microservice
curl http://localhost:3001/health  # Ingestion
curl http://localhost:3002/health  # Stream Processor
curl http://localhost:3003/health  # Notification
curl http://localhost:3004/health  # Alert
curl http://localhost:3005/health  # Tariff
```

### Metrics:
```bash
# Prometheus metrics endpoint
curl http://localhost:3000/metrics
```

### Kafka Monitoring:
```bash
# Check consumer lag
docker exec -i segs-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe --group alert-service-group

# Check topic message count
docker exec -i segs-kafka kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic alerts \
  --time -1
```

### Database Queries:
```sql
-- Count records in each table
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM alerts;
SELECT COUNT(*) FROM tariffs;
SELECT COUNT(*) FROM raw_readings;
SELECT COUNT(*) FROM aggregates_1m;

-- Check alert distribution
SELECT alert_type, severity, COUNT(*) 
FROM alerts 
GROUP BY alert_type, severity;

-- Check tariff pricing by region
SELECT region, rate_per_kwh, updated_at 
FROM tariffs 
ORDER BY updated_at DESC;
```

---

## 🎯 Next Steps

### Immediate (This Session):
1. **Test Invoice Routes** - 12 endpoints, feature-flagged
2. **Fix Stream Processor** - Add min_power_kw, voltage_avg, current_avg calculations

### Short-term (Next Session):
1. **Enhanced Operator Routes** - 10 endpoints for advanced operations
2. **Enhanced Admin Routes** - 15 endpoints for system administration
3. **WebSocket Testing** - Verify real-time notifications end-to-end

### Medium-term:
1. **Performance Testing** - Load testing with multiple concurrent users
2. **Integration Testing** - Automated test suite for all endpoints
3. **Documentation** - API documentation with examples (Swagger/OpenAPI)

### Long-term:
1. **Production Deployment** - Staging environment setup
2. **Scaling Strategy** - Kubernetes deployment, horizontal scaling
3. **Observability** - Grafana dashboards, alerting rules
4. **Security Audit** - Penetration testing, vulnerability scanning

---

## 📚 Documentation Files

- **API_TEST_RESULTS.md** - Complete testing documentation (2133 lines)
- **IMPLEMENTATION_PLAN.md** - Project roadmap and architecture (~500 lines)
- **DEPLOYMENT.md** - Deployment instructions and infrastructure setup
- **TESTING_PHASE_4.md** - Phase 4 testing results
- **TESTING_PHASE_5.md** - Phase 5 testing results
- **PROJECT_STATUS.md** - High-level project status
- **QUICK_REFERENCE.md** - Quick reference guide
- **PROJECT_HANDOFF.md** - Session handoff documentation

---

*Last Updated: November 12, 2025*
*Status: Alert system operational, ready for invoice testing*
