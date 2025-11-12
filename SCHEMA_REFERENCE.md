# Database Schema Reference

This document maps database schemas to TypeScript interfaces for 100% consistency across the Smart Energy Grid system.

## Schema Management

- **PostgreSQL Schema**: `scripts/init-db.sql` (MASTER)
- **TimescaleDB Schema**: `scripts/init-timescale.sql` (MASTER)
- **Service Migrations**: ❌ DELETED - All services use centralized schemas
- **Startup**: `START_SERVICES.sh` runs migrations before starting services

---

## PostgreSQL Tables

### 1. users

**Database Schema** (`scripts/init-db.sql`):
```sql
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- Nullable
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'OPERATOR', 'ADMIN')),
    region VARCHAR(100),
    meter_id VARCHAR(50) UNIQUE,
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    suspended_at TIMESTAMPTZ,
    suspended_reason TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**TypeScript Interface** (`packages/shared-types/src/user.ts`):
```typescript
export type UserRole = 'USER' | 'OPERATOR' | 'ADMIN';

export interface User {
  userId: string;
  name: string;
  email: string;
  region: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
  active?: boolean;
  phone?: string;
}
```

**API Gateway Interface** (`apps/api-gateway/src/services/database/user.service.ts`):
```typescript
export interface User {
  user_id: string;
  email: string;
  password_hash?: string;
  name: string;
  phone?: string;
  role: string;
  region?: string;
  meter_id?: string;
  email_verified: boolean;
  is_active: boolean;
  suspended_at?: Date;
  suspended_reason?: string;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

---

### 2. meters

**Database Schema**:
```sql
CREATE TABLE meters (
    meter_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    region VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED')),
    model VARCHAR(100),
    firmware_version VARCHAR(50),
    address TEXT,
    installed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_reading_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**TypeScript Interface** (`packages/shared-types/src/user.ts`):
```typescript
export type MeterStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export interface Meter {
  meterId: string;
  userId: string;
  region: string;
  installedAt: string;
  status: MeterStatus;
  model?: string;
  firmwareVersion?: string;
  address?: string;
  lastSeenAt?: string;
}
```

---

### 3. alerts

**Database Schema**:
```sql
CREATE TABLE alerts (
    alert_id VARCHAR(50) PRIMARY KEY,
    meter_id VARCHAR(50),
    region VARCHAR(100),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    threshold_value DECIMAL(12, 4),
    actual_value DECIMAL(12, 4),
    metadata JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(50),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Alert Service Interface** (`apps/alert/src/services/postgresService.ts`):
```typescript
export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: Date;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
```

**Shared Types** (`packages/shared-types/src/alert.d.ts`):
```typescript
export interface Alert {
  alertId: string;
  meterId?: string;
  region?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  thresholdValue?: number;
  actualValue?: number;
  metadata?: Record<string, unknown>;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}
```

---

### 4. tariffs

**Database Schema**:
```sql
CREATE TABLE tariffs (
    tariff_id VARCHAR(50) PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    time_of_day VARCHAR(20),  -- NULL for flat rate
    price_per_kwh DECIMAL(10, 4) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    reason TEXT,
    triggered_by VARCHAR(100),
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Tariff Service Interface** (`apps/tariff/src/services/postgresService.ts`):
```typescript
export interface TariffRecord {
  tariffId: string;
  region: string;
  pricePerKwh: number;
  effectiveFrom: Date;
  reason?: string;
  triggeredBy: string;
  createdAt?: Date;
}
```

**API Gateway Interface** (`apps/api-gateway/src/services/external/tariffClient.ts`):
```typescript
export interface TariffData {
  tariff_id: string;
  region: string;
  time_of_day?: string;
  price_per_kwh: number;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  reason?: string;
  triggered_by: string;
}
```

---

### 5. invoices

**Database Schema**:
```sql
CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    meter_id VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL,
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    total_consumption_kwh DECIMAL(10, 2) NOT NULL,
    peak_consumption_kwh DECIMAL(10, 2),
    off_peak_consumption_kwh DECIMAL(10, 2),
    avg_tariff_rate DECIMAL(10, 4) NOT NULL,
    base_cost DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    surcharges DECIMAL(10, 2) DEFAULT 0,
    discounts DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    is_disputed BOOLEAN DEFAULT FALSE,
    disputed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMPTZ,
    pdf_url TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**Shared Types** (`packages/shared-types/src/billing.ts`):
```typescript
export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  userId: string;
  meterId: string;
  region: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalConsumptionKwh: number;
  peakConsumptionKwh?: number;
  offPeakConsumptionKwh?: number;
  avgTariffRate: number;
  baseCost: number;
  taxAmount: number;
  surcharges: number;
  discounts: number;
  totalCost: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt?: string;
}
```

---

### 6. sessions

**Database Schema**:
```sql
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    access_token_jti VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**API Gateway Interface** (`apps/api-gateway/src/services/database/session.service.ts`):
```typescript
export interface Session {
  session_id: string;
  user_id: string;
  refresh_token: string;
  access_token_jti?: string;
  ip_address?: string;
  user_agent?: string;
  is_valid: boolean;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date;
}
```

---

### 7. user_preferences

**Database Schema**:
```sql
CREATE TABLE user_preferences (
    user_id VARCHAR(50) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    websocket_notifications BOOLEAN DEFAULT TRUE,
    alert_high_consumption BOOLEAN DEFAULT TRUE,
    alert_zero_consumption BOOLEAN DEFAULT TRUE,
    alert_tariff_changes BOOLEAN DEFAULT TRUE,
    alert_billing_reminders BOOLEAN DEFAULT TRUE,
    high_consumption_threshold_kwh DECIMAL(10, 2) DEFAULT 100,
    default_chart_resolution VARCHAR(10) DEFAULT '15m',
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**API Gateway Interface** (`apps/api-gateway/src/services/database/preferences.service.ts`):
```typescript
export interface UserPreferences {
  user_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  websocket_notifications: boolean;
  alert_high_consumption: boolean;
  alert_zero_consumption: boolean;
  alert_tariff_changes: boolean;
  alert_billing_reminders: boolean;
  high_consumption_threshold_kwh: number;
  default_chart_resolution: string;
  timezone: string;
  language: string;
  theme: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
```

---

## TimescaleDB Hypertables

### 1. raw_readings

**Database Schema** (`scripts/init-timescale.sql`):
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
```

**Shared Types** (`packages/shared-types/src/telemetry.ts`):
```typescript
export interface TelemetryReading {
  meterId: string;
  region: string;
  timestamp: string;
  powerKw: number;
  voltage?: number;
  current?: number;
  frequency?: number;
  powerFactor?: number;
  temperature?: number;
}
```

---

### 2. aggregates_1m

**Database Schema**:
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
    current_avg DECIMAL(8, 2),
    reading_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Stream Processor Interface** (`apps/stream-processor/src/db/timescale.ts`):
```typescript
export interface Aggregate1m {
  meterId: string;
  region: string;
  windowStart: Date;
  avgPowerKw: number;
  maxPowerKw: number;
  minPowerKw: number;
  energyKwhSum: number;
  voltageAvg: number;
  currentAvg: number;
  readingCount: number;
}
```

**Shared Types** (`packages/shared-types/src/aggregates.ts`):
```typescript
export interface AggregateBase {
  meterId: string;
  region: string;
  windowStart: string;
  windowEnd: string;
  avgPowerKw: number;
  maxPowerKw: number;
  energyKwhSum: number;
  count: number;  // Note: maps to reading_count in DB
}

export type Aggregate1m = AggregateBase & { granularity: '1m'; };
export type Aggregate15m = AggregateBase & { granularity: '15m'; };
```

---

### 3. aggregates_15m

**Database Schema**: Same as `aggregates_1m`

**Stream Processor Interface**: Same as `Aggregate1m`

---

## Field Naming Conventions

### Database (snake_case):
- `user_id`, `meter_id`, `alert_id`
- `created_at`, `updated_at`
- `is_active`, `is_resolved`
- `price_per_kwh`, `energy_kwh_sum`

### TypeScript (camelCase):
- `userId`, `meterId`, `alertId`
- `createdAt`, `updatedAt`
- `isActive`, `isResolved`
- `pricePerKwh`, `energyKwhSum`

### SQL to TypeScript Mapping:
```typescript
// Example query result transformation
const result = await pool.query('SELECT user_id, created_at FROM users');
const user = {
  userId: result.rows[0].user_id,
  createdAt: result.rows[0].created_at
};
```

---

## Data Consistency Rules

1. **Role Values**: Always UPPERCASE (`'USER'`, `'OPERATOR'`, `'ADMIN'`)
   - Database: CHECK constraint enforces uppercase
   - Code: Use `role.toUpperCase()` before INSERT/UPDATE

2. **Nullable Fields**:
   - `password_hash`: Nullable during registration (set after OTP verification)
   - `meter_id`: Nullable in users table (assigned later)
   - `effective_to`: Nullable in tariffs (current active tariff)

3. **Boolean Defaults**:
   - `email_verified`: false
   - `is_active`: true
   - `is_resolved`: false
   - `acknowledged`: false

4. **Timestamp Handling**:
   - Database: Use `TIMESTAMPTZ` for all timestamps
   - TypeScript: Use ISO 8601 strings or Date objects
   - Always store in UTC, convert to user timezone in frontend

5. **Decimal Precision**:
   - Prices: DECIMAL(10, 4) - 6 digits, 4 decimal places
   - Energy: DECIMAL(12, 4) - 8 digits, 4 decimal places
   - Percentages: DECIMAL(5, 2) - 3 digits, 2 decimal places

---

## Migration Workflow

### ❌ NEVER DO THIS:
```typescript
// DON'T create migrations in individual services
await pool.query(readFileSync('./migrations/001.sql'));
```

### ✅ ALWAYS DO THIS:
1. Update `scripts/init-db.sql` or `scripts/init-timescale.sql`
2. Run `./START_SERVICES.sh` (migrations run automatically)
3. Update TypeScript interfaces in `packages/shared-types/src/`
4. Rebuild services: `pnpm build`

---

## Verification Checklist

- [ ] All tables defined in `scripts/init-db.sql`
- [ ] All hypertables defined in `scripts/init-timescale.sql`
- [ ] All TypeScript interfaces match database columns
- [ ] Field names follow conventions (snake_case DB, camelCase TS)
- [ ] CHECK constraints match TypeScript enums
- [ ] Nullable fields documented
- [ ] Default values match between DB and TS
- [ ] No service-level migration files exist
- [ ] `START_SERVICES.sh` runs migrations first

---

Last Updated: 2025-11-12
